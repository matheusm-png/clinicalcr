-- ============================================================
-- Sprint 6 — Comissão de dentistas
-- Migration 0012: % de comissão por profissional + atribuição
--                 de produção (procedimentos -> profissional)
-- ============================================================

-- Percentual de comissão padrão do profissional (ex.: 40.00 = 40%).
alter table public.profissionais
  add column if not exists comissao_percentual numeric(5,2) not null default 0;

-- Atribuição da produção: a qual profissional o procedimento pertence.
-- (on delete set null: remover o profissional não apaga o histórico clínico.)
alter table public.procedimentos
  add column if not exists profissional_id bigint
    references public.profissionais(id) on delete set null;

create index if not exists idx_procedimentos_profissional
  on public.procedimentos(profissional_id);
