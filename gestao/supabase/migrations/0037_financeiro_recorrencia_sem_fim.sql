-- 0037 — Recorrência sem data de fim
--
-- A 0035 gera todas as parcelas de uma vez (máx. 60). Para "sem fim" (salário,
-- aluguel) o app gera só 12 meses à frente e, toda vez que o Financeiro abre,
-- completa o que faltar para manter 12 meses à frente. Sem job/cron.
--
-- serie_sem_fim = true marca a série que deve ser renovada. Cancelar a série
-- desliga a flag em todas as parcelas dela (senão a renovação recriaria).
--
-- O índice único impede parcela duplicada se duas telas renovarem ao mesmo
-- tempo (o insert usa ON CONFLICT DO NOTHING). Lançamento avulso tem
-- serie_id NULL e não colide (NULL é distinto no índice).

alter table public.transacoes_financeiras
  add column if not exists serie_sem_fim boolean not null default false;

create unique index if not exists uq_transacoes_serie_parcela
  on public.transacoes_financeiras(serie_id, serie_parcela);
