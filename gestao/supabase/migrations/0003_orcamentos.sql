-- ============================================================
-- Sprint 1 — Plano de Tratamento + Orçamento
-- Migration 0003: catálogo de procedimentos + orçamentos + itens
-- ============================================================

-- Catálogo de procedimentos com preços (base para orçar)
create table if not exists public.procedimentos_catalogo (
  id          bigint generated always as identity primary key,
  nome        text not null,
  categoria   text,
  preco       numeric(12,2) not null default 0,
  duracao_min int,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Orçamento (cabeçalho)
create table if not exists public.orcamentos (
  id           bigint generated always as identity primary key,
  paciente_id  bigint references public.pacientes(id) on delete cascade,
  status       text not null default 'rascunho', -- rascunho|enviado|aprovado|recusado
  desconto     numeric(12,2) not null default 0,
  total        numeric(12,2) not null default 0,
  observacoes  text,
  aprovado_em  timestamptz,
  created_at   timestamptz not null default now()
);

-- Itens do orçamento (snapshot do nome/preço no momento)
create table if not exists public.orcamento_itens (
  id             bigint generated always as identity primary key,
  orcamento_id   bigint not null references public.orcamentos(id) on delete cascade,
  catalogo_id    bigint references public.procedimentos_catalogo(id) on delete set null,
  descricao      text not null,
  dente          text,
  quantidade     int not null default 1,
  valor_unitario numeric(12,2) not null default 0,
  created_at     timestamptz not null default now()
);

-- ─── RLS ──────────────────────────────────────────────────
alter table public.procedimentos_catalogo enable row level security;
alter table public.orcamentos             enable row level security;
alter table public.orcamento_itens        enable row level security;

do $$
declare t text;
begin
  foreach t in array array['procedimentos_catalogo','orcamentos','orcamento_itens']
  loop
    execute format($f$
      create policy "%1$s_select" on public.%1$s
        for select to authenticated using (true);
      create policy "%1$s_insert" on public.%1$s
        for insert to authenticated with check (true);
      create policy "%1$s_update" on public.%1$s
        for update to authenticated using (true) with check (true);
      create policy "%1$s_delete" on public.%1$s
        for delete to authenticated
        using (public.papel_atual() in ('admin','dentista'));
    $f$, t);
  end loop;
end $$;

-- ─── Seed de catálogo (procedimentos comuns) ──────────────
insert into public.procedimentos_catalogo (nome, categoria, preco, duracao_min) values
  ('Consulta de avaliação',        'Clínica Geral', 150,  30),
  ('Limpeza / Profilaxia',         'Prevenção',     180,  40),
  ('Restauração em resina',        'Dentística',    250,  50),
  ('Tratamento de canal',          'Endodontia',    900,  90),
  ('Extração simples',             'Cirurgia',      300,  40),
  ('Clareamento dental',           'Estética',      800,  60),
  ('Lente de porcelana (unidade)', 'Estética',     1600,  90),
  ('Coroa de porcelana',           'Prótese',      1400,  60);
