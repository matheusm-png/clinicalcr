-- =====================================================================
-- RESET DE DADOS DE TESTE — Clínica LCR
-- =====================================================================
-- ⚠️  IRREVERSÍVEL. Apaga TODOS os dados operacionais e de configuração
--     (pacientes, catálogo, estoque, equipe, financeiro, agenda, anexos…).
-- MANTÉM apenas:
--   • auth.users + public.profiles  (usuários / login + permissões)
--   • public.clinicas               (registro da clínica — obrigatório p/ o app)
--
-- NÃO fica em supabase/migrations/ de propósito: é um script manual,
-- rodado à mão no SQL Editor do Supabase. Não roda em deploy.
-- =====================================================================

truncate table
  public.parcelas,
  public.contas_receber,
  public.transacoes_financeiras,
  public.orcamento_itens,
  public.orcamentos,
  public.procedimentos,
  public.anamneses,
  public.evolucoes,
  public.documentos,
  public.anexos,
  public.proteses,
  public.marcadores,
  public.agendamentos,
  public.solicitacoes_agendamento,
  public.frigobar_registros,
  public.itens_estoque,
  public.procedimentos_catalogo,
  public.medicamentos,
  public.modelos_anamnese,
  public.modelos_documento,
  public.profissionais,
  public.auditoria
restart identity cascade;

-- OBS.: os arquivos do Storage (bucket "anexos") NÃO podem ser apagados por SQL
-- (o Supabase bloqueia por segurança). Limpe pelo painel:
-- Supabase → Storage → bucket "anexos" → selecionar tudo → Delete.
