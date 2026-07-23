import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aiVisao, aiConfigurado } from "@/lib/ai";
import { montarPrompt } from "@/lib/ai/prompts";

// A leitura da ficha (OpenAI visão) pode levar 10-20s; sobe o teto da função
// serverless na Vercel para não estourar timeout e devolver HTML em vez de JSON.
export const maxDuration = 60;

// Recebe foto(s) da ficha COMPLETA (anamnese + odontograma/procedimentos) → IA de
// visão → JSON estruturado { anamnese, procedimentos[] }.
// Dado de saúde do paciente: NÃO logamos o conteúdo extraído nem as imagens.
const MAX_TOTAL = 25 * 1024 * 1024; // ~25MB no total
const MAX_IMAGENS = 8;

type Proc = { data: string | null; descricao: string; dente: string | null; valorPago: number | null };

// Aceita number, "80,00", "R$ 80,00", "80.00" → 80. Caso contrário null.
function parseValor(v: unknown): number | null {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v !== "string") return null;
  const limpo = v.replace(/[^0-9.,-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = parseFloat(limpo);
  return isFinite(n) ? n : null;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!aiConfigurado()) return NextResponse.json({ error: "IA não configurada." }, { status: 503 });

  const form = await req.formData().catch(() => null);
  const arquivos = (form?.getAll("imagens") ?? []).filter((f): f is File => f instanceof File);
  if (arquivos.length === 0) {
    return NextResponse.json({ error: "Envie ao menos uma imagem no campo 'imagens'." }, { status: 400 });
  }
  if (arquivos.length > MAX_IMAGENS) {
    return NextResponse.json({ error: `Máximo de ${MAX_IMAGENS} imagens por ficha.` }, { status: 413 });
  }

  let total = 0;
  const dataUrls: string[] = [];
  for (const f of arquivos) {
    if (!f.type.startsWith("image/")) {
      return NextResponse.json({ error: "Envie apenas imagens (foto da ficha)." }, { status: 415 });
    }
    total += f.size;
    if (total > MAX_TOTAL) {
      return NextResponse.json({ error: "Imagens muito grandes (máx. ~25MB no total)." }, { status: 413 });
    }
    const b64 = Buffer.from(await f.arrayBuffer()).toString("base64");
    dataUrls.push(`data:${f.type};base64,${b64}`);
  }

  try {
    const prompt = montarPrompt("ocr-ficha-completa", {})!;
    const saida = await aiVisao(dataUrls, prompt, { maxTokens: 2600 });

    // Parse defensivo: remove cercas ```json e isola o primeiro objeto { ... }.
    let texto = saida.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    const ini = texto.indexOf("{");
    const fim = texto.lastIndexOf("}");
    if (ini >= 0 && fim > ini) texto = texto.slice(ini, fim + 1);

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(texto);
    } catch {
      return NextResponse.json(
        { error: "A IA não retornou um JSON válido. Tente fotos mais nítidas e bem enquadradas." },
        { status: 502 },
      );
    }

    // A IA pode devolver { anamnese, procedimentos } ou (fallback) os campos soltos.
    const anamnese = (parsed.anamnese && typeof parsed.anamnese === "object"
      ? parsed.anamnese
      : parsed) as Record<string, unknown>;

    const brutos = Array.isArray(parsed.procedimentos) ? (parsed.procedimentos as unknown[]) : [];
    const procedimentos: Proc[] = brutos
      .filter((p): p is Record<string, unknown> => !!p && typeof p === "object")
      .map((p) => ({
        data: p.data != null ? String(p.data) : null,
        descricao: p.descricao != null ? String(p.descricao) : "",
        dente: p.dente != null && String(p.dente).trim() !== "" ? String(p.dente).trim() : null,
        valorPago: parseValor(p.valorPago),
      }))
      .filter((p) => p.descricao.trim() !== "" || p.valorPago != null);

    const revisar = Array.isArray(parsed._revisar) ? (parsed._revisar as unknown[]).map(String) : [];
    // Não vaza a estrutura interna de volta como "dado"
    delete (anamnese as Record<string, unknown>)._revisar;
    delete (anamnese as Record<string, unknown>).procedimentos;

    return NextResponse.json({ dados: anamnese, procedimentos, revisar });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Falha ao processar a ficha." },
      { status: 502 },
    );
  }
}
