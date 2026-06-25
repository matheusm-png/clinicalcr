# Roadmap — Gestão Clínica LCR

Plano de evolução do app para nível de mercado (referências: Capim, Simples Dental, Clínica nas Nuvens, EasyDental, Amplimed, Dental Speed).

Os "sprints" abaixo são **marcos de entrega** ordenados por dependência e impacto — cada um entrega valor utilizável. Itens marcados com 🔌 dependem de contas/integrações externas; ⚙️ dependem do Supabase ligado.

> Última revisão do plano: **2026-06-25**.

---

## ✅ Entregue e em produção (app.clinicalcr.com.br)

- **Sprint 0** — Supabase ligado (Postgres + RLS + Auth por papéis + Storage), multi-tenant.
- **Sprint 1** — Catálogo de procedimentos, orçamento (status, desconto, parcelas, aprovação → prontuário + a receber), impressão/PDF.
- **Sprint 2** — Financeiro avançado: contas a receber, parcelamento, inadimplência, formas de pagamento, fluxo de caixa.
- **Sprint 3** — Prontuário rico: evolução clínica (+ ditado por voz/Whisper), anexos (Storage), documentos com assinatura e PDF.
- **Sprint 4** — Multiprofissional, agenda por profissional, comparecimento (compareceu/faltou), retornos/recall, aniversários.
- **Sprint 5** — Relatórios/BI: faturamento por mês, produção, comparecimento, desempenho por profissional, novos pacientes; export CSV/PDF.
- **Sprint 6** — Comissão de dentistas: % por profissional sobre a produção realizada, resumo + detalhamento, CSV/PDF.
- **IA (AI-first)** — análise de risco da anamnese, explicador de orçamento, mensagem de cobrança, ditado→evolução, assistente copiloto, e **OCR de fichas de anamnese por foto** (câmera → preenche a anamnese, com revisão humana).
- **F1** — Agenda com **data absoluta** + **mini-calendário** do mês.
- **C1** — Agenda PRO: horário de funcionamento configurável, marcadores/cadeiras coloridos, bloqueio de agenda.
- **C2** — Catálogo odontológico padrão importável (12 especialidades).
- **C3** — Recuperação de pacientes: kanban de Faltas e Desmarcados + WhatsApp.
- **C4** — Clínico customizável: modelos de documentos, receituário com base de medicamentos, modelos de anamnese.
- **C6** — Simulador de parcelamento (Tabela Price).

> _Deploy de 2026-06-25 (commit `48308f5`, Vercel `dpl_F54jnkA7h1sxKNuLSYpumTw9PJ8L`)._

---

## 🗂️ PRÓXIMA LEVA — organizada por responsável (2026-06-25)

Tudo que falta, separado por **quem faz**. Atalho: um **PAT do Supabase** elimina o passo "colar SQL" e deixa a Trilha A 100% autônoma.

### 🟩 Trilha A — Claude implementa (autônomo)
Único passo do usuário: **colar 1 SQL** quando houver tabela nova (🗄️).
- **A1 — C7 Relatórios financeiros avançados** (fluxo de caixa com previsão/inadimplência, preço médio, distribuição de receita). _Sem SQL._
- **A2 — Acabamentos** (custo manual no procedimento; atribuir profissional no orçamento aprovado; autor real; histórico de anamnese mostrar o nome do modelo; procedimento do modal da agenda puxar do catálogo; botão "reabrir" consulta desmarcada). _Sem SQL._
- **A3 — C5 Controle protético** (kanban solicitação → laboratório → retornada → instalada). 🗄️
- **A4 — S8 Agendamento online público** (página pública + caixa de entrada no admin; confirmação por WhatsApp fica pra depois do B2). 🗄️
- **A5 — C8 Migração guiada + permissões granulares**. 🗄️
- **A6 — F2 Signup de nova clínica** (cadastro de clínica + 1º admin). 🗄️
- **A7 — Dashboard turbinado + PWA** (instalável no celular). _Sem SQL._

### 🟦 Trilha B — Usuário precisa fazer (painel/contas); Claude faz o código depois
- **B1 — F3 Higiene/deploy**: rotacionar segredos (Supabase secret key + OpenAI), setar Supabase Auth URL de produção (Site URL + Redirect `https://app.clinicalcr.com.br/**`), conectar GitHub→Vercel (Root Directory=`gestao`) para auto-deploy. _Claude escreve o guia passo a passo._
- **B2 — Conta WhatsApp Business Platform (Meta)** + número + `WA_ACCESS_TOKEN`/`WA_PHONE_NUMBER_ID`/`WA_WABA_ID` → **destrava S7** (lembretes automáticos, confirmação, campanhas de reativação, aniversário automático). Reaproveita o cliente do `alquimia-crm`.
- **B3 — Conta de gateway** (ex.: Mercado Pago) + chaves → **destrava S9** (Pix/cartão/boleto + conciliação).
- **B4 — Decisão sobre convênios** → **S10** (TISS + NF-e), só se a clínica atender convênio.

---

## 🔧 Fundamentos (fazer primeiro — destravam o resto)

### F1 — Agenda com data absoluta ✅ *(concluído — 2026-06-24)*
Antes `agendamentos` guardava `dia` 0–6 (relativo à semana de criação), fazendo a consulta vazar para todas as semanas e travando lembrete automático, BI por período fiel e agendamento online.
- ✅ Migration **0013**: coluna `data date` (NOT NULL + índice), backfill dos existentes, `dia` agora nullable (mantida sem uso).
- ✅ Grade semanal passa a ancorar por data absoluta; dashboard ("hoje"/"próximos") e relatórios (comparecimento/desempenho por período) agora usam a data real.

### F2 — Onboarding multi-tenant (SaaS)
Falta o fluxo de cadastro de **nova clínica + 1º admin** (o trigger cria o profile com `clinica_id` NULL; só dá pra criar usuário dentro de uma clínica existente). Necessário para vender para uma 2ª clínica.

### F3 — Higiene de segurança & deploy
- Rotacionar segredos que passaram por chat (Supabase secret key, OpenAI).
- Configurar **Supabase Auth URL** de produção (Site URL + Redirect).
- Conectar **GitHub → Vercel** (Root Directory = `gestao`) para auto-deploy (hoje é deploy manual via CLI).

---

## 📲 Sprint 7 — WhatsApp (com tudo)  🔌
**Por que:** reduz falta e gera receita; é o recurso mais pedido.
Reaproveita o cliente da **WhatsApp Cloud API oficial** já feito no projeto `alquimia-crm` (port enxuto).
- **Camada `lib/whatsapp`** (`sendSessionText`, `sendTemplate`, `buildBodyComponents`, mock-aware) + rota `/api/whatsapp` autenticada.
- **Consentimento LGPD**: campo de opt-in de WhatsApp no paciente.
- **Templates** aprovados na Meta (`confirmacao_consulta`, `lembrete_consulta`).
- **Outbound manual**: botões "Confirmar/Lembrar" na Agenda e Retornos (envio real pelo número da clínica).
- **Inbound (webhook)**: endpoint público + verify token + app secret; armazenar mensagens; janela de 24h; paciente responde "1" → confirma presença.
- **Lembrete automático**: Vercel Cron varrendo as consultas do dia seguinte → **depende de F1**.
- *Externo (cliente):* número da clínica no WhatsApp Business Platform + `WA_ACCESS_TOKEN`, `WA_PHONE_NUMBER_ID`, `WA_WABA_ID`.

## 📅 Sprint 8 — Agendamento online público
**Por que:** o paciente marca sozinho, sem ligar. Decisão tomada: **sem login de paciente**.
- Página pública de solicitação de horário; tabela de **solicitações** com data absoluta.
- Caixa de entrada no admin para confirmar (→ vira agendamento); anti-spam; confirmação por WhatsApp.
- **Depende de F1.**

## 💳 Sprint 9 — Pagamentos  🔌
**Por que:** receber Pix/cartão/boleto direto, com conciliação automática.
- Gateway (ex.: Mercado Pago), link de pagamento, conciliação com "A Receber"/parcelas.
- *Externo (cliente):* conta + chaves do gateway.

## 🏥 Sprint 10 — Convênios / TISS + NF-e  🔌 *(avançado, opcional)*
- Cadastro de convênios, tabela **TUSS**, geração de **guia TISS**; emissão de **NF-e/NFS-e**.
- Só se a clínica atender convênios.

---

## 🌱 Sprints inspirados no Capim (análise dos prints — 2026-06-24)

Após estudar o sistema do Capim print a print, estes são os **gaps** que viram feature. Já estamos em paridade (ou à frente, por sermos **AI-first**: OCR de anamnese, assistente IA, análise de risco) em agenda, pacientes, prontuário, orçamentos, a receber, financeiro, estoque, comissões, relatórios e documentos. Legenda: 🟢 pequeno · 🟡 médio · 🔴 grande · 🔌 conta externa · ✅ depende de F1 (feito).

### C1 — Agenda PRO 🟡 ✅ *(concluído — 2026-06-25, migration 0014)*
- ✅ **Horário de funcionamento configurável** (acaba a grade fixa 7–18h): aba Agenda no Config (abre/fecha às) → grade e opções de horário dinâmicas.
- ✅ **Marcadores coloridos** (cadeiras/salas/tipo) nos eventos: CRUD na aba Agenda do Config + seletor no modal + bolinha colorida no bloco.
- ✅ **Bloqueio de agenda** como tipo de criação (botão "Bloquear horário"; sem paciente/procedimento, campo Motivo).
- *(Link de agendamento fica no S8 — agendamento online.)*

### C2 — Catálogo odontológico completo 🟢 ✅ *(concluído — 2026-06-24)*
- ✅ Botão **"Importar catálogo padrão"** na tela de Catálogo (e no estado vazio): insere ~61 procedimentos curados em 12 especialidades com **preço sugerido** (editável), pulando os que já existem por nome. Lista em `src/lib/catalogo/padrao.ts`; insert em lote `DB.catalogo.importarMuitos` (clinica_id carimbado pelo banco, multi-tenant, sem migration). Idempotente.

### C3 — Recuperação de pacientes (Central de relacionamento) 🟡 ✅ *(concluído — 2026-06-25, migration 0015)*
- ✅ Página `/admin/relacionamento`: **kanban de Faltas** (Faltou → Contato realizado → Remarcado → Compareceu) e **Desmarcados**, com mover ←/→, WhatsApp por card (mensagem personalizada) e filtro de período (data absoluta). Faltas = `presenca='faltou'`; Desmarcados = `cancelado=true`.
- ✅ Agenda: botão **"Desmarcar"** no modal (mantém o registro p/ recuperação, some da grade). Migration 0015 (`recuperacao` + `cancelado`).

### C4 — Clínico customizável 🔴 ✅ *(concluído — 2026-06-25, migrations 0016/0017/0018)*
- ✅ **Modelos de documentos** customizáveis (Config › Documentos; placeholders {{paciente}} etc.; seletor agrupado no prontuário).
- ✅ **Receituário com base de medicamentos** (base curada + favoritos da clínica; quick-insert no editor de receituário).
- ✅ **Modelos de anamnese** customizáveis (opção escolhida: **mantém o wizard fixo + OCR** e adiciona fichas próprias — builder em `/admin/modelos-anamnese`, preenchimento dinâmico, seletor no prontuário).

### C5 — Controle protético 🟡
- **Kanban de solicitação de prótese** (Criada → Enviada ao laboratório → Retornada → Instalada), ligado ao paciente/procedimento, com prazos.

### C6 — Simulador de parcelamento 🟢 ✅ *(concluído — 2026-06-25)*
- ✅ Página `/admin/simulador` (link no Sidebar): valor + entrada (R$/%) + nº parcelas + juros (% a.m.); Tabela Price (parcelas fixas) com amortização; KPIs (parcelado/juros/total). Sem migration.

### C7 — Relatórios financeiros avançados 🟡
- **Fluxo de caixa com previsão/inadimplência**, **preço médio** e **distribuição de receita** por procedimento/profissional, detalhamento por forma de pagamento.

### C8 — Permissões granulares + migração guiada 🟡
- **Permissões finas por usuário** (toggles por módulo, além dos 3 papéis) — encaixa com F2.
- **Wizard de migração** (pacientes/agenda/financeiro/fichas) para captar clínicas vindas de planilha/concorrente.

**Já cobertos pelo roadmap existente (não duplicar):** lembretes automáticos (Central de notificações) + campanhas de reativação + aniversário automático → **S7**; link/agendamento online → **S8**; maquininha/gateway + **conciliação** bancária → **S9**; convênios → **S10**.

---

## 🧹 Acabamentos (completar o que já existe — encaixam ao longo)
- **Custo do procedimento**: o modal do prontuário grava `R$150` fixo — adicionar campo de custo (afeta comissão/produção).
- **Orçamento aprovado**: atribuir o profissional aos procedimentos gerados (hoje saem sem, e não entram na comissão).
- **Anamnese**: inputs para os campos que o OCR extrai mas o wizard não tem (profissão, identidade, observações, hábitos…) — hoje só ficam no JSON de respostas.
- **Autor real** em evoluções/anexos/documentos (hoje "Dra. Lara Camila" fixo).
- **Dashboard turbinado** e **PWA** (instalável no celular).
- **LGPD**: termo de consentimento, log de auditoria, exportação/backup.

---

## Ordem recomendada (revisada 2026-06-24, com sprints do Capim)
**C2 → C1 → C3 → S7 (WhatsApp) → C4 → S8 (online) → C5 → C6 → C7 → F2+C8 → S9 → S10.**
Transversais ao longo do caminho: **F3** (higiene/deploy, rápido) e os **acabamentos**.

Racional: prioriza **impacto na clínica real** e **baixa dependência externa** primeiro — C2 e C1 são ganhos rápidos e visíveis; C3 recupera receita com o que já temos; S7 é o maior multiplicador (mas exige conta Meta); C4 é o grande diferencial clínico. F1 (feito) já destravou lembrete automático (S7), agendamento online (S8) e BI por período.
