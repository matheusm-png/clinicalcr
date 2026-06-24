import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aiTranscrever, aiChat, aiConfigurado } from "@/lib/ai";
import { montarPrompt } from "@/lib/ai/prompts";

// Recebe áudio (multipart) → transcreve (Whisper) → estrutura como evolução clínica.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!aiConfigurado()) return NextResponse.json({ error: "IA não configurada." }, { status: 503 });

  const form = await req.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof Blob)) {
    return NextResponse.json({ error: "Envie o áudio no campo 'audio'." }, { status: 400 });
  }
  // Limite de tamanho (~20MB)
  if (audio.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: "Áudio muito grande (máx. 20MB)." }, { status: 413 });
  }

  try {
    const transcricao = await aiTranscrever(audio, "evolucao.webm");
    if (!transcricao) return NextResponse.json({ transcricao: "", evolucao: "" });
    const prompt = montarPrompt("estruturar-evolucao", { texto: transcricao })!;
    const evolucao = await aiChat(prompt, { maxTokens: 500 });
    return NextResponse.json({ transcricao, evolucao });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha na transcrição." }, { status: 502 });
  }
}
