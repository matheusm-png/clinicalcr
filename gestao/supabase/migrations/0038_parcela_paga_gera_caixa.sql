-- 0038 — Pagamento de paciente cai sozinho no caixa
--
-- Decisão (17/11/2026): o dinheiro passa a ser lançado SÓ no app. O caixa
-- (transacoes_financeiras) é a fonte única do que entrou; contas a receber /
-- parcelas são o controle por paciente (histórico, a receber, atraso).
--
-- Até 10/11/2026 o caixa veio da planilha "MOVIMENTO DE CAIXA" (importada),
-- que já inclui os pagamentos de pacientes. A partir de 11/11/2026, toda
-- parcela marcada como paga — pelo prontuário, por "A receber" ou pelo
-- pagamento online — gera a linha de receita no caixa, ligada à parcela.
-- Parcela paga antes dessa data não gera nada (já está na planilha, ou é
-- histórico das fichas de papel, anterior ao caixa).
--
--   parcela vira paga        → cria a linha (ou atualiza valor/data/forma)
--   parcela volta a pendente → apaga a linha
--   parcela apagada          → apaga a linha (FK cascade)

alter table public.transacoes_financeiras
  add column if not exists parcela_id bigint references public.parcelas(id) on delete cascade;

create unique index if not exists uq_transacoes_parcela
  on public.transacoes_financeiras(parcela_id);

create or replace function public.caixa_inicio_automatico()
returns date language sql immutable as $$ select date '2026-11-11' $$;

create or replace function public.parcela_gera_caixa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_desc text;
begin
  if new.pago and new.pago_em is not null and new.pago_em >= caixa_inicio_automatico() then
    select coalesce(nullif(trim(p.nome), ''), 'Paciente')
           || ' — ' || coalesce(nullif(trim(c.descricao), ''), 'Atendimento')
           || case when new.numero > 1 then ' (parcela ' || new.numero || ')' else '' end
      into v_desc
      from contas_receber c
      left join pacientes p on p.id = c.paciente_id
     where c.id = new.conta_id;

    insert into transacoes_financeiras
      (clinica_id, tipo, descricao, valor, categoria, data, status, forma_pagamento, parcela_id)
    values
      (new.clinica_id, 'receita', left(coalesce(v_desc, 'Pagamento de paciente'), 240), new.valor,
       'Atendimentos', new.pago_em, 'pago', new.forma_pagamento, new.id)
    on conflict (parcela_id) do update
      set valor = excluded.valor,
          data = excluded.data,
          forma_pagamento = excluded.forma_pagamento,
          status = 'pago';
  elsif tg_op = 'UPDATE' then
    delete from transacoes_financeiras where parcela_id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists trg_parcela_gera_caixa on public.parcelas;
create trigger trg_parcela_gera_caixa
  after insert or update of pago, pago_em, valor, forma_pagamento on public.parcelas
  for each row execute function public.parcela_gera_caixa();

-- Parcelas já pagas desde 11/11 (antes do gatilho existir) entram agora.
update public.parcelas set pago = pago
 where pago and pago_em >= caixa_inicio_automatico();
