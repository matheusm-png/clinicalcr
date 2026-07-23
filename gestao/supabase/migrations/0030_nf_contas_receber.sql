-- 0030 — Nota fiscal emitida (flag) nas contas a receber
-- Marcador simples sim/não por cobrança: registra se foi emitida NF para aquele
-- recebimento. Usado no fluxo "Importar ficha por foto" e na tela A Receber.
-- (Por ora só o booleano; número/série da NF podem ser adicionados no futuro.)

alter table public.contas_receber
  add column if not exists nf_emitida boolean not null default false;
