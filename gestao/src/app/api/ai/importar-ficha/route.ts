import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aiConfigurado } from "@/lib/ai";
import { lerFichaCompleta } from "@/lib/ai/fichaCompleta";

// A leitura da ficha (OpenAI visão) pode levar 10-20s; sobe o teto da função
// serverless na Vercel para não estourar timeout e devolver HTML em vez de JSON.
export const maxDuration = 60;

// Recebe foto(s) da ficha COMPLETA (anamnese + odontograma/procedimentos) → IA de
// visão → JSON estruturado { anamnese, procedimentos[] }.
// Dado de saúde do paciente: NÃO logamos o conteúdo extraído nem as imagens.
const MAX_TOTAL = 25 * 1024 * 1024; // ~25MB no total
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
      return NextResponse.json({ error: "Imagens muito grandes (máx. ~25MB no total)." }, { status: 413 });
    }
    const b64 = Buffer.from(await f.arrayBuffer()).toString("base64");
    dataUrls.push(`data:${f.type};base64,${b64}`);
  }

  try {
    return NextResponse.json(await lerFichaCompleta(dataUrls));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Falha ao processar a ficha." },
      { status: 502 },
    );
  }
}
