import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aiVisao, aiConfigurado } from "@/lib/ai";
import { montarPrompt } from "@/lib/ai/prompts";

// Recebe foto(s) da ficha de anamnese manuscrita (multipart) → IA de visão → JSON estruturado.
// Dado de saúde do paciente: NÃO logamos o conteúdo extraído nem as imagens.
const MAX_TOTAL = 20 * 1024 * 1024; // ~20MB no total
const MAX_IMAGENS = 8;

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
      return NextResponse.json({ error: "Imagens muito grandes (máx. ~20MB no total)." }, { status: 413 });
    }
    const b64 = Buffer.from(await f.arrayBuffer()).toString("base64");
    dataUrls.push(`data:${f.type};base64,${b64}`);
  }

  try {
    const prompt = montarPrompt("ocr-ficha-anamnese", {})!;
    const saida = await aiVisao(dataUrls, prompt, { maxTokens: 1800 });

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

    const revisar = Array.isArray(parsed._revisar) ? (parsed._revisar as unknown[]).map(String) : [];
    delete parsed._revisar;
    return NextResponse.json({ dados: parsed, revisar });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Falha ao processar a ficha." },
      { status: 502 },
    );
  }
}
