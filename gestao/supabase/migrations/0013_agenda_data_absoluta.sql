-- F1 — Agenda com data absoluta
-- Hoje agendamentos.dia guarda 0..6 RELATIVO à segunda-feira da semana em que
-- foi criado (não uma data real). Isso faz o agendamento "vazar" para todas as
-- semanas na grade e impede lembrete automático, BI por período fiel e
-- agendamento online. Migramos para uma coluna `data` (date) absoluta.

alter table public.agendamentos
  add column if not exists data date;

-- Backfill best-effort dos registros existentes: a segunda-feira (ISO week) da
-- semana de created_at + o offset `dia`. date_trunc('week', ...) retorna segunda.
update public.agendamentos
set data = (date_trunc('week', created_at)::date + dia)
where data is null and dia is not null;

-- Sem created_at/dia confiável, cai para hoje (não deixa NULL travando a UI).
update public.agendamentos
set data = current_date
where data is null;

alter table public.agendamentos
  alter column data set not null;

-- `dia` deixa de ser obrigatório (o app passa a enviar `data`). Mantemos a
-- coluna por ora para não quebrar nada legado; pode ser removida no futuro.
alter table public.agendamentos
  alter column dia drop not null;

create index if not exists idx_agendamentos_data on public.agendamentos (data);
