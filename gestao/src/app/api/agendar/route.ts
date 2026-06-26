import { NextResponse } from "next/server";
import { createAdminClient, adminConfigurado } from "@/lib/supabase/admin";

// Rota PÚBLICA (sem login): recebe a solicitação de horário do paciente e
// grava na caixa de entrada. Usa o admin client (service key) e carimba o
// clinica_id explicitamente — não há policy de insert pública na tabela.
export async function POST(req: Request) {
  if (!adminConfigurado()) {
    return NextResponse.json({ error: "Agendamento online indisponível." }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Dados inválidos." }, { status: 400 }); }

  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const nome = str(body.nome, 120);
  const telefone = str(body.telefone, 30);
  const email = str(body.email, 120);
  const procedimento = str(body.procedimento, 120);
  const dataPreferida = str(body.dataPreferida, 10); // yyyy-mm-dd
  const periodoRaw = str(body.periodo, 10);
  const periodo = ["manha", "tarde", "qualquer"].includes(periodoRaw) ? periodoRaw : "qualquer";
  const obs = str(body.obs, 500);

  if (!nome || telefone.replace(/\D/g, "").length < 8) {
    return NextResponse.json({ error: "Informe seu nome e um telefone válido." }, { status: 400 });
  }

  const admin = createAdminClient();

  // Resolve a clínica que aceita agendamento online (single-tenant: a única).
  const { data: clinica } = await admin
    .from("clinicas")
    .select("id, agendamento_online")
    .eq("agendamento_online", true)
    .order("id")
    .limit(1)
    .maybeSingle();
  if (!clinica) {
    return NextResponse.json({ error: "Agendamento online indisponível no momento." }, { status: 503 });
  }

  const { error } = await admin.from("solicitacoes_agendamento").insert({
    clinica_id: clinica.id,
    nome,
    telefone,
    email: email || null,
    procedimento,
    data_preferida: dataPreferida || null,
    periodo,
    obs,
    status: "pendente",
  });
  if (error) {
    return NextResponse.json({ error: "Não foi possível registrar a solicitação." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
