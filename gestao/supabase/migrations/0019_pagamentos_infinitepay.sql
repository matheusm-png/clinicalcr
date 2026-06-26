-- ============================================================
-- S9 — Pagamentos online (InfinitePay Checkout)
-- Migration 0019: handle da clínica + rastreio de link/pagamento por parcela.
-- ============================================================

-- InfiniteTag (handle, sem "$") da conta InfinitePay da clínica. Única credencial
-- necessária p/ gerar links e revalidar pagamentos (não há secret key no Checkout).
alter table public.clinicas
  add column if not exists infinitepay_handle text;

-- Rastreio do link de pagamento gerado para cada parcela.
alter table public.parcelas
  add column if not exists pagto_link text;       -- URL do checkout
alter table public.parcelas
  add column if not exists pagto_order_nsu text;   -- order_nsu enviado (= id da parcela)
alter table public.parcelas
  add column if not exists pagto_slug text;        -- invoice_slug confirmado pelo webhook

-- O webhook (admin client, sem sessão) localiza a parcela pelo order_nsu.
create index if not exists idx_parcelas_pagto_order_nsu
  on public.parcelas (pagto_order_nsu);
