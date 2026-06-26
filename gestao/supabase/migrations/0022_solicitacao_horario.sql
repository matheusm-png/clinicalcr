-- ============================================================
-- S8.1 — Agendamento online com horário escolhido
-- Migration 0022: o paciente agora pode escolher um horário específico
-- (a partir da grade de horários livres da agenda real). Guardamos o
-- horário preferido na solicitação para a clínica confirmar em 1 clique.
-- ============================================================

alter table public.solicitacoes_agendamento
  add column if not exists hora_preferida int,   -- 0..23, null = sem horário escolhido
  add column if not exists min_preferida  int;   -- 0..59
