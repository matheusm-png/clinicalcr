-- 0034 — Link para o paciente aceitar o orçamento e assinar a anamnese
--
-- A clínica gera um link /p/<token> e manda pelo WhatsApp. O paciente abre no
-- celular, sem login, vê o orçamento (e/ou a anamnese) e assina na tela.
-- Aceitar o orçamento = aprovar: gera os procedimentos "a realizar" na ficha.
--
-- O token é o único "login" do paciente: aleatório (uuid v4), expira, e vale
-- uma vez (concluido_em). A página pública NÃO lê as tabelas direto — passa
-- pela rota /api/p/[token], que usa a service key e só devolve o que o link cobre.

create table if not exists public.links_paciente (
  id             bigint generated always as identity primary key,
  clinica_id     bigint references public.clinicas(id) default public.clinica_atual(),
  token          uuid not null unique default gen_random_uuid(),
  paciente_id    bigint not null references public.pacientes(id) on delete cascade,
  orcamento_id   bigint references public.orcamentos(id) on delete cascade,
  anamnese_id    bigint references public.anamneses(id) on delete cascade,
  expira_em      timestamptz not null default (now() + interval '7 days'),
  aberto_em      timestamptz,          -- primeira vez que o paciente abriu
  concluido_em   timestamptz,          -- paciente assinou; link não vale mais
  criado_por     uuid default auth.uid(),
  created_at     timestamptz not null default now(),
  constraint links_paciente_algo check (orcamento_id is not null or anamnese_id is not null)
);

create index if not exists idx_links_paciente_paciente on public.links_paciente(paciente_id);

alter table public.links_paciente enable row level security;

drop policy if exists "links_paciente_clinica" on public.links_paciente;
create policy "links_paciente_clinica" on public.links_paciente
  for all to authenticated
  using (clinica_id = public.clinica_atual())
  with check (clinica_id = public.clinica_atual());

-- Registro do aceite no orçamento (assinatura + quando + de onde).
alter table public.orcamentos
  add column if not exists aceite_assinatura text,   -- data-URL PNG
  add column if not exists aceite_em         timestamptz,
  add column if not exists aceite_ip         text;

-- Autorização de fotos e divulgação nas redes sociais (texto do rodapé da ficha
-- de papel). null = nunca respondeu. Gravada pelo link do paciente, com data.
alter table public.pacientes
  add column if not exists autoriza_imagem     boolean,
  add column if not exists autoriza_imagem_em  timestamptz;

-- Quando/de onde a anamnese foi assinada pelo link (a assinatura já tem coluna).
alter table public.anamneses
  add column if not exists assinada_em  timestamptz,
  add column if not exists assinada_ip  text;
