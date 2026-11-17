-- 0039 — Sublocação de sala na agenda (etapa 1: controle de horário)
-- Dentistas de fora alugam sala por hora, turno ou diária e atendem pacientes
-- próprios. A clínica só precisa saber quem está em qual sala e quando.
--
-- • profissionais.tipo: 'clinica' (equipe, entra em comissões/agendamento
--   online) ou 'sublocatario' (só aparece nas reservas de sala).
-- • agendamentos com status 'sublocacao' = reserva de sala (sem paciente).
--   A sala é o marcador (Cadeira 1, Sala 2…).
-- • sublocacao_modalidade: hora | turno | diaria (base da cobrança na etapa 2).
-- • serie_id: reservas fixas semanais geradas juntas (cancelar a série).

alter table public.profissionais
  add column if not exists tipo text not null default 'clinica';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profissionais_tipo_chk') then
    alter table public.profissionais
      add constraint profissionais_tipo_chk check (tipo in ('clinica', 'sublocatario'));
  end if;
end $$;

alter table public.agendamentos
  add column if not exists sublocacao_modalidade text,
  add column if not exists serie_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'agendamentos_sublocacao_modalidade_chk') then
    alter table public.agendamentos
      add constraint agendamentos_sublocacao_modalidade_chk
      check (sublocacao_modalidade is null or sublocacao_modalidade in ('hora', 'turno', 'diaria'));
  end if;
end $$;

create index if not exists idx_agendamentos_serie on public.agendamentos (serie_id) where serie_id is not null;
