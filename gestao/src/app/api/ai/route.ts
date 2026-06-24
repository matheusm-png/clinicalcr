import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aiChat, aiConfigurado } from "@/lib/ai";
import { montarPrompt, type AiTask } from "@/lib/ai/prompts";

// Rota de IA (texto). Protegida por login — só usuário autenticado pode gastar créditos.
export async function POST(req: Request) {
  // 1. Exige sessão Supabase válida.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (!aiConfigurado()) {
    return NextResponse.json(
      { error: "IA não configurada no servidor (defina OPENAI_API_KEY)." },
      { status: 503 },
    );
  }

  // 2. Lê e valida o corpo.
  let body: { task?: AiTask; input?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  if (!body.task) {
    return NextResponse.json({ error: "Informe a 'task'." }, { status: 400 });
  }

  const messages = montarPrompt(body.task, body.input);
  if (!messages) {
    return NextResponse.json({ error: `Task desconhecida: ${body.task}` }, { status: 400 });
  }

  // 3. Limite simples de tamanho de entrada (proteção de custo).
  const tamanho = JSON.stringify(body.input ?? "").length;
  if (tamanho > 12000) {
    return NextResponse.json({ error: "Entrada muito grande." }, { status: 413 });
  }

  // 4. Chama a IA.
  try {
    const result = await aiChat(messages);
    return NextResponse.json({ result });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Falha na IA." },
      { status: 502 },
    );
  }
}
