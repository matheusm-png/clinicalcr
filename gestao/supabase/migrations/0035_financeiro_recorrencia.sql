-- 0035 — Lançamento recorrente (ex.: salário da recepcionista todo dia 5)
--
-- Abordagem: ao salvar um lançamento recorrente, o app já gera TODAS as
-- parcelas (uma linha por mês) de uma vez. Cada linha continua sendo um
-- lançamento normal — entra nos totais, no filtro do mês, pode ser marcada
-- paga ou apagada sozinha. O que liga as parcelas é o serie_id: com ele dá
-- pra cancelar "esta e as próximas" de uma vez.
--
-- Sem job/cron: nada roda sozinho, o que está na tela é o que está no banco.

alter table public.transacoes_financeiras
  add column if not exists serie_id      uuid,
  add column if not exists serie_parcela int,   -- 1, 2, 3…
  add column if not exists serie_total   int;   -- quantas parcelas foram geradas

create index if not exists idx_transacoes_serie
  on public.transacoes_financeiras(serie_id) where serie_id is not null;
