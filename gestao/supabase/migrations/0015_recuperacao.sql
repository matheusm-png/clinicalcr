-- ============================================================
-- C3 — Recuperação de pacientes (Central de relacionamento)
-- Migration 0015: pipeline de recuperação de faltas/desmarcações.
-- ============================================================

-- Estágio no funil de recuperação (para consultas faltadas/desmarcadas):
--   null = pendente (Faltou/Desmarcou) · 'contatado' · 'remarcado' · 'recuperado' (Compareceu)
alter table public.agendamentos
  add column if not exists recuperacao text;

-- Marca a consulta como DESMARCADA pelo paciente (mantém o registro p/ recuperação,
-- em vez de excluir). Some da grade, aparece no kanban de Desmarcados.
alter table public.agendamentos
  add column if not exists cancelado boolean not null default false;

create index if not exists idx_agendamentos_recuperacao
  on public.agendamentos (cancelado, presenca);
