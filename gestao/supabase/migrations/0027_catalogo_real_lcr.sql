-- 0027 — Catálogo REAL da Clínica LCR (tabela de procedimentos + preços da Mila, 2026-07-22)
-- Substitui os ~66 procedimentos "sugeridos" (seed genérico) pela tabela real dela.
-- O FK orcamento_itens.catalogo_id é ON DELETE SET NULL → orçamentos demo não quebram.
-- Os 2 implantes vieram SEM preço → entram como ativo=false até a Mila passar o valor.

begin;

delete from procedimentos_catalogo where clinica_id = 1;

insert into procedimentos_catalogo (nome, categoria, preco, duracao_min, ativo, clinica_id) values
  ('Consulta',                                          'Clínica Geral',   50,    30, true, 1),
  ('Radiografia periapical/interproximal',              'Radiologia',      30,    30, true, 1),
  ('Limpeza (raspagem, profilaxia e flúor)',            'Periodontia',     200,   60, true, 1),
  ('Profilaxia e aplicação de flúor',                   'Prevenção',       120,   30, true, 1),
  ('Limpeza infantil',                                  'Odontopediatria', 150,   60, true, 1),
  ('Restauração em resina — 1 face',                    'Dentística',      120,   60, true, 1),
  ('Restauração em resina — 2 faces',                   'Dentística',      150,   90, true, 1),
  ('Restauração em resina estética',                    'Estética',        200,   90, true, 1),
  ('Restauração infantil em resina',                    'Odontopediatria', 100,   60, true, 1),
  ('Restauração provisória com CIV',                    'Dentística',      100,   60, true, 1),
  ('Aplicação de selante',                              'Prevenção',       50,    30, true, 1),
  ('Clareamento em consultório (sessão)',               'Estética',        300,   90, true, 1),
  ('Clareamento — tratamento completo',                 'Estética',        1500,  90, true, 1),
  ('Clareamento caseiro',                               'Estética',        800,   60, true, 1),
  ('Exodontia de decíduo',                              'Cirurgia',        100,   60, true, 1),
  ('Exodontia permanente simples',                      'Cirurgia',        200,   90, true, 1),
  ('Exodontia de terceiro molar (siso)',                'Cirurgia',        300,   90, true, 1),
  ('Exodontia de dente incluso',                        'Cirurgia',        500,   120, true, 1),
  ('Sessão de fluorterapia',                            'Prevenção',       50,    30, true, 1),
  ('Prótese total (Biolux)',                            'Prótese',         1200,  40, true, 1),
  ('Prótese total (Trilux)',                            'Prótese',         1450,  40, true, 1),
  ('Prótese parcial removível (Biolux)',                'Prótese',         1300,  40, true, 1),
  ('Prótese parcial removível (Trilux)',                'Prótese',         1500,  40, true, 1),
  ('Prótese parcial removível Flex (Biolux)',           'Prótese',         1200,  40, true, 1),
  ('Prótese parcial removível Flex (Trilux)',           'Prótese',         1300,  40, true, 1),
  ('Tratamento endodôntico',                            'Endodontia',      750,   100, true, 1),
  ('Instalação de aparelho ortodôntico (convencional)', 'Ortodontia',      200,   40, true, 1),
  ('Manutenção de aparelho ortodôntico (convencional)', 'Ortodontia',      120,   20, true, 1),
  ('Instalação de aparelho ortodôntico (autoligado)',   'Ortodontia',      600,   30, true, 1),
  ('Manutenção de aparelho ortodôntico (autoligado)',   'Ortodontia',      150,   20, true, 1),
  ('Gengivoplastia',                                    'Periodontia',     800,   90, true, 1),
  ('Gengivoplastia com osteotomia',                     'Periodontia',     1200,  120, true, 1),
  ('Implante anterior',                                 'Implantodontia',  0,     60, false, 1),
  ('Implante posterior',                                'Implantodontia',  0,     60, false, 1);

commit;
