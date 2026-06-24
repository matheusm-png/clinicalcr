# Roadmap — Gestão Clínica LCR

Plano de evolução do app para nível de mercado (referências: Capim, Simples Dental, Clínica nas Nuvens, EasyDental, Amplimed, Dental Speed).

Os "sprints" abaixo são **marcos de entrega** ordenados por dependência e impacto — cada um entrega valor utilizável. Itens marcados com 🔌 dependem de contas/integrações externas; ⚙️ dependem do Supabase ligado.

---

## ✅ Já entregue (base)
- Dashboard, Agenda semanal, Pacientes (cadastro completo + editar/excluir), Prontuário com odontograma, Anamnese com assinatura, Financeiro básico, Estoque.
- Fundação técnica: migração para **Supabase** (Postgres + RLS + Auth por papéis) — código pronto, aguardando o projeto/keys.
- UX: responsivo mobile, toasts, estados vazios, modais bottom-sheet.

## ⚙️ Sprint 0 — Ligar o Supabase (pré-requisito)
**Objetivo:** sair do modo demonstração e ter persistência real, multiusuário e Storage.
- Criar projeto Supabase (Gmail da clínica), rodar migrations, criar usuários/papéis.
- Ativar **Supabase Storage** (necessário para anexos do prontuário).
- Verificação end-to-end de tudo que já existe.
> Sem isso, vários sprints abaixo ficam só "de fachada".

---

## Sprint 1 — Plano de Tratamento + Orçamento  ⭐ (núcleo)
**Por que:** é o coração do software odontológico e alimenta agenda + financeiro.
- **Catálogo de procedimentos** com preços (tabela configurável) — base para orçar.
- **Plano de tratamento**: seleciona procedimentos + dentes (integra com o odontograma), define sessões e valores.
- **Orçamento**: gera documento, status (rascunho → enviado → aprovado → recusado), desconto, total e parcelas previstas.
- **Aprovação** do paciente → vira itens executáveis no prontuário + lançamentos a receber.
- Impressão/compartilhamento do orçamento (PDF).
- *Entidades novas:* `procedimentos_catalogo`, `orcamentos`, `orcamento_itens`.

## Sprint 2 — Financeiro avançado
**Por que:** hoje é um caixa avulso; precisa virar gestão financeira real.
- Lançamento **vinculado a paciente/orçamento/procedimento**.
- **Contas a receber** com **parcelamento** (carnê), datas de vencimento.
- **Controle de inadimplência** (em atraso, alertas, total a receber).
- Formas de pagamento (dinheiro, Pix, cartão, boleto) e **emissão de recibo** (PDF).
- Relatório de fluxo de caixa por período (melhora o resumo atual).
- *Entidades novas:* `contas_receber`, `parcelas`, `formas_pagamento`.

## Sprint 3 — Prontuário rico  ⚙️
**Por que:** prontuário digital completo é exigência clínica e de LGPD.
- **Evolução clínica**: anotações por consulta/atendimento (timeline do paciente).
- **Anexos**: fotos, radiografias, exames e documentos (Supabase Storage) com galeria.
- **Documentos**: receituário, atestado, declaração, contrato — a partir de **modelos customizáveis**, com **assinatura** (reaproveita o canvas) e geração de PDF.
- *Entidades novas:* `evolucoes`, `anexos`, `documentos`, `modelos_documento`.

## Sprint 4 — Multiprofissional + Agenda avançada
**Por que:** permite a clínica crescer além de uma dentista.
- Cadastro de **profissionais** (e salas/cadeiras), agenda **por profissional** com filtro.
- **Bloqueios** de agenda (reuniões, almoço), status de **comparecimento** (compareceu/faltou) → base de taxa de presença.
- **Recall/retornos**: lista de pacientes para revisão/manutenção.
- **Aniversários** do dia.
- *Entidades novas:* `profissionais`, `salas` (opcional); campos em `agendamentos`.

## Sprint 5 — Relatórios / BI
**Por que:** decisão baseada em dados; diferencial dos líderes.
- Produção (procedimentos realizados), **faturamento por período**, recebido vs a receber.
- **Taxa de comparecimento/faltas**, novos pacientes, desempenho **por profissional**.
- Exportação PDF/CSV.

## Sprint 6 — Comissão de dentistas
**Por que:** padrão do mercado para clínicas com vários profissionais.
- Regras de **% por profissional/procedimento/convênio**, cálculo automático sobre o realizado/recebido, relatório de comissão.
- *Depende de:* Sprint 2 (financeiro) + Sprint 4 (profissionais).

## Sprint 7 — Integrações  🔌
**Por que:** automações que reduzem falta e geram receita (forte na Capim).
- **WhatsApp**: confirmação automática e lembretes de consulta.
- **Agendamento online**: link público para o paciente marcar sozinho.
- **Pagamentos**: Pix/cartão/boleto integrados (gateway).
> Requer contas/credenciais externas (provedor WhatsApp, gateway de pagamento).

## Sprint 8 — Convênios / TISS + NF-e  🔌 (avançado, opcional)
- Cadastro de convênios, tabela **TUSS**, geração de **guia TISS**.
- Emissão de **NF-e/NFS-e** de serviços.
> Mais complexo e regulatório; só se a clínica atender convênios.

---

## Extras / transversais (encaixam ao longo dos sprints)
- **Configurações da clínica**: horário de funcionamento, salas/cadeiras, categorias, formas de pagamento, dados para documentos.
- **Portal do paciente** (futuro): ver orçamento, histórico e agendar.
- **Controle protético** (kanban de próteses) — estilo Capim.
- **LGPD**: termo de consentimento, log de auditoria, exportação/backup de dados.
- **Dashboard turbinado**: KPIs reais (faturamento, a receber, taxa de presença, retornos pendentes).
- **PWA**: instalável no celular (atalho na tela inicial) — alternativa leve ao "app".

## Notas de priorização
Sequência recomendada: **0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8**.
Sprints 1–3 são os que mais tiram a sensação de "simples". 7 e 8 dependem de decisões de negócio (custos de integração, se atende convênio).
