-- 0032 — Procedimento: data de execução, pagamento e retorno
--
-- 1) DATA DE EXECUÇÃO
--    A tabela só tinha `created_at` (quando foi digitado). Com o cadastro
--    retroativo das fichas antigas, tudo que for digitado hoje entraria como
--    produção de hoje — relatórios e comissões sairiam errados. Agora a data
--    real do atendimento é um campo próprio, e os relatórios usam
--    `data` quando existe (caindo para created_at nos registros antigos).
--    O Importar Ficha guardava essa data como texto dentro de `obs`
--    ("Executado em 12/08/2026"); passa a gravar aqui.
--
-- 2) PAGAMENTO
--    Registro de como o procedimento foi pago (forma, se está pago, se saiu NF).
--    É registro do prontuário — não gera cobrança sozinho, para não duplicar
--    o que vem de orçamento aprovado / Importar Ficha.
--
-- 3) RETORNO
--    Antes só existia UMA data de revisão por paciente, preenchível apenas na
--    tela Retornos. Agora o retorno pode ser marcado no próprio procedimento.

alter table public.procedimentos
  add column if not exists data            date,
  add column if not exists forma_pagamento text,
  add column if not exists pago            boolean not null default false,
  add column if not exists nf_emitida      boolean not null default false,
  add column if not exists retorno_em      date,
  add column if not exists retorno_obs     text;

comment on column public.procedimentos.data is
  'Data em que o procedimento foi executado. NULL = registros antigos (usar created_at).';
comment on column public.procedimentos.retorno_em is
  'Data do retorno combinado para este procedimento. Alimenta a tela Retornos.';

-- Relatórios e comissões filtram produção por período: índice pela data efetiva.
create index if not exists procedimentos_data_idx
  on public.procedimentos (clinica_id, data);

-- Backfill: procedimentos importados por foto guardaram a data em `obs`
-- no formato "Executado em dd/mm/aaaa". Recupera para a coluna nova.
update public.procedimentos
   set data = to_date(substring(obs from 'Executado em (\d{2}/\d{2}/\d{4})'), 'DD/MM/YYYY')
 where data is null
   and obs ~ 'Executado em \d{2}/\d{2}/\d{4}';
