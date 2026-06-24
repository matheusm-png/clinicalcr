-- ============================================================
-- Sprint 4 — Comparecimento + Retornos
-- Migration 0011: presença na agenda + próxima revisão do paciente
-- ============================================================

-- Comparecimento: eixo separado do status de agendamento.
alter table public.agendamentos
  add column if not exists presenca text not null default 'agendado';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'agendamentos_presenca_chk'
  ) then
    alter table public.agendamentos
      add constraint agendamentos_presenca_chk
      check (presenca in ('agendado', 'compareceu', 'faltou'));
  end if;
end $$;

-- Retornos/recall: data explícita da próxima revisão do paciente.
alter table public.pacientes
  add column if not exists proxima_revisao date;

create index if not exists idx_pacientes_proxima_revisao on public.pacientes(proxima_revisao);
