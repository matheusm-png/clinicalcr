-- ============================================================
-- Estoque nível Vigilância Sanitária (VISA)
-- Migration 0025:
--   (a) campos de controle sanitário por produto no estoque
--       (fabricante, lote, data de fabricação, data de validade)
--   (b) tabela de controle de temperatura do frigobar (faixa 2–8 °C)
-- ============================================================

-- (a) Campos sanitários no estoque -----------------------------------------
alter table public.itens_estoque add column if not exists fabricante      text;
alter table public.itens_estoque add column if not exists lote            text;
alter table public.itens_estoque add column if not exists data_fabricacao date;
alter table public.itens_estoque add column if not exists data_validade   date;

create index if not exists idx_estoque_validade on public.itens_estoque(data_validade);

-- (b) Controle de temperatura do frigobar ----------------------------------
create table if not exists public.frigobar_registros (
  id             bigint generated always as identity primary key,
  clinica_id     bigint references public.clinicas(id) default public.clinica_atual(),
  data           date not null,
  entrada_hora   text,                 -- HH:MM da aferição de entrada
  entrada_temp   numeric(4,1),         -- temperatura de entrada em °C
  saida_hora     text,                 -- HH:MM da aferição de saída
  saida_temp     numeric(4,1),         -- temperatura de saída em °C
  acao_corretiva text not null default '', -- registro da ação quando fora da faixa 2–8 °C
  responsavel    text not null default '', -- quem aferiu
  obs            text not null default '',
  created_at     timestamptz not null default now()
);

alter table public.frigobar_registros enable row level security;

drop policy if exists "frigobar_select" on public.frigobar_registros;
drop policy if exists "frigobar_insert" on public.frigobar_registros;
drop policy if exists "frigobar_update" on public.frigobar_registros;
drop policy if exists "frigobar_delete" on public.frigobar_registros;

create policy "frigobar_select" on public.frigobar_registros
  for select to authenticated using (clinica_id = public.clinica_atual());
create policy "frigobar_insert" on public.frigobar_registros
  for insert to authenticated with check (clinica_id = public.clinica_atual());
create policy "frigobar_update" on public.frigobar_registros
  for update to authenticated
  using (clinica_id = public.clinica_atual()) with check (clinica_id = public.clinica_atual());
create policy "frigobar_delete" on public.frigobar_registros
  for delete to authenticated using (clinica_id = public.clinica_atual());

create index if not exists idx_frigobar_clinica on public.frigobar_registros(clinica_id);
create index if not exists idx_frigobar_data on public.frigobar_registros(data);
