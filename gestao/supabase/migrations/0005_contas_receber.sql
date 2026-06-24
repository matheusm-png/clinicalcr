-- ============================================================
-- Sprint 2 — Financeiro avançado
-- Migration 0005: contas a receber + parcelas (multi-tenant)
-- ============================================================

create table if not exists public.contas_receber (
  id           bigint generated always as identity primary key,
  clinica_id   bigint references public.clinicas(id) default public.clinica_atual(),
  paciente_id  bigint references public.pacientes(id) on delete cascade,
  orcamento_id bigint references public.orcamentos(id) on delete set null,
  descricao    text not null,
  valor_total  numeric(12,2) not null default 0,
  status       text not null default 'aberta', -- aberta|quitada|cancelada
  created_at   timestamptz not null default now()
);

create table if not exists public.parcelas (
  id              bigint generated always as identity primary key,
  clinica_id      bigint references public.clinicas(id) default public.clinica_atual(),
  conta_id        bigint not null references public.contas_receber(id) on delete cascade,
  numero          int not null default 1,
  valor           numeric(12,2) not null default 0,
  vencimento      date,
  pago            boolean not null default false,
  pago_em         date,
  forma_pagamento text,
  created_at      timestamptz not null default now()
);

-- ─── RLS (operacional: front desk gerencia cobranças) ─────
alter table public.contas_receber enable row level security;
alter table public.parcelas       enable row level security;

do $$
declare t text;
begin
  foreach t in array array['contas_receber','parcelas']
  loop
    execute format('drop policy if exists "%1$s_select" on public.%1$s', t);
    execute format('drop policy if exists "%1$s_insert" on public.%1$s', t);
    execute format('drop policy if exists "%1$s_update" on public.%1$s', t);
    execute format('drop policy if exists "%1$s_delete" on public.%1$s', t);
    execute format($f$
      create policy "%1$s_select" on public.%1$s
        for select to authenticated using (clinica_id = public.clinica_atual());
      create policy "%1$s_insert" on public.%1$s
        for insert to authenticated with check (clinica_id = public.clinica_atual());
      create policy "%1$s_update" on public.%1$s
        for update to authenticated
        using (clinica_id = public.clinica_atual())
        with check (clinica_id = public.clinica_atual());
      create policy "%1$s_delete" on public.%1$s
        for delete to authenticated
        using (clinica_id = public.clinica_atual() and public.papel_atual() in ('admin','dentista'));
    $f$, t);
  end loop;
end $$;

create index if not exists idx_parcelas_conta on public.parcelas(conta_id);
create index if not exists idx_contas_paciente on public.contas_receber(paciente_id);
