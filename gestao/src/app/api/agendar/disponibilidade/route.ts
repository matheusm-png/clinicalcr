import { NextResponse } from "next/server";
import { createAdminClient, adminConfigurado } from "@/lib/supabase/admin";

// Rota PÚBLICA (sem login): devolve os horários livres de uma data, calculados
// a partir da agenda real (consultas marcadas + expediente da clínica) e dos
// pedidos pendentes que já escolheram horário (soft-hold). Usa o admin client.

const SLOT_MIN = 30; // granularidade da grade

export async function GET(req: Request) {
  if (!adminConfigurado()) {
    return NextResponse.json({ error: "Agendamento online indisponível." }, { status: 503 });
  }

  const data = new URL(req.url).searchParams.get("data") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return NextResponse.json({ error: "Data inválida." }, { status: 400 });
  }

  // Não permite datas passadas (compara só a parte da data, fuso local do servidor).
  const hojeStr = new Date().toLocaleDateString("en-CA"); // yyyy-mm-dd
  if (data < hojeStr) {
    return NextResponse.json({ slots: [] });
  }

  const admin = createAdminClient();

  const { data: clinica } = await admin
    .from("clinicas")
    .select("id, agenda_hora_inicio, agenda_hora_fim, agendamento_online")
    .eq("agendamento_online", true)
    .order("id")
    .limit(1)
    .maybeSingle();
  if (!clinica) {
    return NextResponse.json({ slots: [] });
  }

  const inicio = clinica.agenda_hora_inicio ?? 7;
  const fim = clinica.agenda_hora_fim ?? 19;

  // Intervalos ocupados (em minutos desde 00:00) das consultas já marcadas.
  const { data: ags } = await admin
    .from("agendamentos")
    .select("hora, min, dur, status")
    .eq("data", data)
    .neq("status", "cancelado");

  // Pedidos pendentes que já escolheram horário (soft-hold).
  const { data: sols } = await admin
    .from("solicitacoes_agendamento")
    .select("hora_preferida, min_preferida")
    .eq("data_preferida", data)
    .eq("status", "pendente")
    .not("hora_preferida", "is", null);

  const ocupados: Array<[number, number]> = [];
  for (const a of ags ?? []) {
    const ini = (a.hora ?? 0) * 60 + (a.min ?? 0);
    ocupados.push([ini, ini + (a.dur ?? SLOT_MIN)]);
  }
  for (const s of sols ?? []) {
    const ini = (s.hora_preferida ?? 0) * 60 + (s.min_preferida ?? 0);
    ocupados.push([ini, ini + SLOT_MIN]);
  }

  // Para o dia de hoje, esconde horários que já passaram (com folga de 30 min).
  const agora = new Date();
  const minAtual = data === hojeStr ? agora.getHours() * 60 + agora.getMinutes() + SLOT_MIN : -1;

  const slots: Array<{ hora: number; min: number; label: string }> = [];
  for (let m = inicio * 60; m + SLOT_MIN <= fim * 60; m += SLOT_MIN) {
    if (m < minAtual) continue;
    const colide = ocupados.some(([oi, of]) => m < of && m + SLOT_MIN > oi);
    if (colide) continue;
    const h = Math.floor(m / 60);
    const mi = m % 60;
    slots.push({ hora: h, min: mi, label: `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}` });
  }

  return NextResponse.json({ slots });
}
