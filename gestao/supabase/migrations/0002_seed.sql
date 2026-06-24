-- ============================================================
-- Migration 0002: dados de exemplo (opcional)
-- Mesmos mocks que existiam no antigo db.ts (localStorage).
-- Rode UMA vez se quiser começar com dados de demonstração.
-- Para começar limpo, simplesmente NÃO rode este arquivo.
-- ============================================================

insert into public.pacientes (nome, cpf, tel, plano, status) values
  ('Maria Silva',        '123.456.789-00', '(74) 99123-4567', 'Unimed',         'Ativo'),
  ('João Pereira',       '987.654.321-11', '(74) 98877-6655', 'Particular',     'Ativo'),
  ('Ana Beatriz Santos', '456.789.123-22', '(74) 99911-2233', 'Bradesco Saúde', 'Ativo'),
  ('Carlos Mendes',      '321.654.987-33', '(74) 98112-2334', 'Particular',     'Inativo');

-- Agendamentos referenciam pacientes pelo nome (resolve o id real).
insert into public.agendamentos (paciente, paciente_id, proc, dia, hora, min, dur, status, obs)
select v.paciente, p.id, v.proc, v.dia, v.hora, v.min, v.dur, v.status, v.obs
from (values
  ('Maria Silva',        'Limpeza / Profilaxia',   1,  8,  0, 30, 'confirmado', 'Paciente super pontual'),
  ('João Pereira',       'Consulta de Avaliação',  1,  9, 30, 45, 'confirmado', null),
  ('Ana Beatriz Santos', 'Lente de Porcelana',     2, 14,  0, 90, 'confirmado', null),
  ('Carlos Mendes',      'Consulta de Retorno',    3, 16,  0, 30, 'pendente',   null)
) as v(paciente, proc, dia, hora, min, dur, status, obs)
left join public.pacientes p on p.nome = v.paciente;

insert into public.itens_estoque (nome, quantidade, minimo, categoria, fornecedor) values
  ('Resina Composta Z350 XT',      14,  5, 'Dentística',   'Dental Cremer'),
  ('Anestésico Mepivacaína 2%',     3,  5, 'Anestésicos',  'Dental Cremer'),
  ('Luva Latex Nitrílica M',       22, 10, 'Descartáveis', 'Dental Speed'),
  ('Agulha Gengival Curta',       120, 50, 'Agulhas',      'Dental Speed');

insert into public.transacoes_financeiras (tipo, descricao, valor, categoria, data, status) values
  ('receita', 'Lentes de Porcelana - Ana Beatriz', 3200, 'Estética',      current_date, 'pago'),
  ('receita', 'Profilaxia - Maria Silva',           150, 'Clínica Geral', current_date, 'pago'),
  ('despesa', 'Compra de Luvas e Máscaras',         450, 'Insumos',       current_date, 'pago'),
  ('receita', 'Tratamento de Canal - João',         850, 'Endodontia',    current_date, 'pendente');
