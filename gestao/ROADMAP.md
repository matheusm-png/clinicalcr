# Roadmap — Gestão Clínica LCR

Plano de evolução do app para nível de mercado (referências: Capim, Simples Dental, Clínica nas Nuvens, EasyDental, Amplimed, Dental Speed).

Os "sprints" abaixo são **marcos de entrega** ordenados por dependência e impacto — cada um entrega valor utilizável. Itens marcados com 🔌 dependem de contas/integrações externas; ⚙️ dependem do Supabase ligado.

> Última revisão do plano: **2026-07-06**.

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
- **C5** — Controle protético: kanban solicitada → laboratório → retornou → instalada, com alerta de atraso.
- **C6** — Simulador de parcelamento (Tabela Price).
- **C7** — Relatórios financeiros avançados: fluxo de caixa com previsão/inadimplência (aging), ticket médio, distribuição por forma de pagamento.
- **A2 — Acabamentos**: custo manual no procedimento (fim do R$150 fixo) + catálogo no procedimento, autor real (não mais "Dra. Lara Camila" fixo), profissional no orçamento aprovado, histórico de anamnese com nome do modelo, procedimento da agenda puxa do catálogo, reabrir consulta desmarcada.
- **A7 — Dashboard turbinado + PWA**: painel "Precisa de atenção" (pendências acionáveis) + app instalável no celular.
- **S8** — Agendamento online público (`/agendar` como landing page + horários reais da agenda) + caixa de entrada em `/admin/solicitacoes`.
- **S9** — Pagamentos InfinitePay (link Pix/cartão + webhook): **código no ar; falta só a Mila cadastrar a InfiniteTag** em Config › Minha Clínica p/ cobrar de verdade.

> _Deploys de 2026-06-25/26 (commits `6d1d207`→`d29f1f7`). Migrations aplicadas até 0022. Deploy é sempre `npx vercel@latest --prod --yes` de `gestao/` — push não auto-deploya._

---

## 🗂️ PLANO DE EXECUÇÃO — revisado pós-reunião com a Mila (2026-07-16)

Foco: **consolidar a LCR como clínica única** e deixar o app pronto pra operação real + compliance. Multi-clínica e convênios ficam pra depois. Claude aplica migrations sozinho (PAT no `.env.local`). Detalhes de cada item novo em `../DOCS/WORKLIST-APP-REUNIAO-MILA.md`.

> **⚠️ Estado da árvore (2026-07-16):** LGPD **Parte 1 (consentimento, migration 0023)** + **Parte 2 (auditoria, migration 0024)** estão FEITAS e aplicadas no banco, mas **NÃO commitadas nem deployadas** (na árvore: `src/lib/lgpd/`, `admin/auditoria/`, 0023/0024, e edits em pacientes/prontuario/Sidebar/db/types). Fecham junto com a Parte 3.

### 🟩 FASE 1 — Quick wins do prontuário (rápidos, sem dep., alto uso diário)
1. **Orçamento: desconto em % (não R$)** — `orcamentos/page.tsx` hoje faz `total = subtotal − desconto` em reais → virar percentual (mostrar o R$ ao lado). _Sem SQL (reinterpreta a coluna; sobrescrever dados de teste)._
2. **Prontuário: busca/seleção de paciente na página** — hoje só abre via `?id=` (travado num paciente); adicionar seletor com busca pra trocar de paciente sem sair. _Sem SQL._
3. **Prontuário: abas faltando** — Next tem 5 (Ficha/Anamnese/Evoluções/Anexos/Documentos); o protótipo HTML tem 8. Adicionar **Orçamentos**, **Financeiro** e **Consultas** (do paciente) + renomear **Anexos → Arquivos**. _Sem SQL._

### 🟩 FASE 2 — Estoque nível Vigilância Sanitária (VISA) 🗄️
4. **Campos de controle sanitário por produto**: nome, fabricante, lote, data de fabricação, data de validade, **situação calculada** (dentro da validade / vence em breve / vencido; "vence em breve" = ≤30 dias, confirmar com a Mila).
5. **Controle de temperatura do frigobar**: faixa 2–8 °C; tabela data · entrada(hora+temp) · saída(hora+temp); **alerta de ação corretiva** quando fora da faixa + registro da ação.
6. **Export PDF pra VISA**: relatório de estoque (validades/situação) + planilha de frigobar (temperaturas/ações). Padrão window.print A4 (sem lib).

### 🟩 FASE 3 — LGPD completa + fechar o que está na árvore 🗄️
7. **LGPD Parte 3 — exportação/portabilidade** dos dados do paciente (+ backup da clínica). Fechar, **commitar e deployar** as Partes 1+2+3 juntas.

### 🟩 FASE 4 — Prontuário/IA — captura de paciente
8. **OCR da ficha cria paciente E anamnese** — hoje o OCR só pré-preenche a anamnese; a mesma foto deve **criar o cadastro do paciente** também. _Sem SQL._
9. **Inputs do OCR de anamnese** — campos que o OCR extrai mas o wizard não tem UI (profissão, identidade/RG, observações, hábitos). _Sem SQL._

### 🟩 FASE 5 — Odontograma (parte autônoma) 🗄️(talvez)
10. **Paridade com o HTML**: seleção por **marquee (arrastar)**, modal **ficha-do-dente** (histórico por dente), ação de status em massa.
11. **Seleção por sextante** — dividir a boca em 6 grupos (S1 18-14 · S2 13-23 · S3 24-28 · S4 34-38 · S5 33-43 · S6 44-48); botões pra selecionar o grupo de uma vez. _Confirmar com a Mila quais procedimentos usam sextante._

### 🟩 FASE 6 — C8 (gestão/onboarding) 🗄️
12. **C8 — Wizard de migração guiada** (importar pacientes/agenda/financeiro de planilha/sistema antigo).
13. **C8 — Permissões granulares** por usuário (toggles por módulo além dos 3 papéis).

### 🎨 Transversal — marca (conteúdo, combinar com a Mila)
14. **Reposicionamento: prevenção + acompanhamento de longo prazo** (não "transformação"). Revisar copy da **landing** (hero "voltar a sorrir" é transformação) e dar destaque a recall/manutenção no app.

### 🟠 BLOQUEADO na Mila (destrava quando ela entregar)
- **Lista completa de procedimentos + valores atualizados** → destrava o **visual de cada procedimento no odontograma** (item 3a do worklist: `PROC_VISUALS` só desenha ~7 nomes; catálogo tem ~66) + atualização de preços do catálogo.
- **Quais procedimentos são por sextante** → completa o item 11.
- **Novo tom de marca** → item 14.

### 🟦 Depende de terceiros
- **S7 — WhatsApp** ⏳ **aguardando a conta Meta** (a Mila vai liberar o acesso). Código pronto pra portar do `alquimia-crm`. Ao receber: `WA_ACCESS_TOKEN`/`WA_PHONE_NUMBER_ID`/`WA_WABA_ID` + aprovar templates. Maior multiplicador (derruba falta).
- **S9 — ir ao vivo**: só a **InfiniteTag da Mila** em Config › Minha Clínica. Código já em produção.
- **F3 — Rotação de segredos** (Supabase secret key + OpenAI) ⏸️ **adiada pro LANÇAMENTO**. Auth URL de prod e GitHub→Vercel já configurados.
- **F2 — Signup de nova clínica** ⏳ **adiado (futuro)** — só quando vender pra 2ª clínica.

### ❌ Fora de escopo (decisão do usuário)
- **S10 — Convênios / TISS + NF-e**: a LCR **não atende convênio**. Descartado (reabrir só se mudar).

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

### C5 — Controle protético 🟡 ✅ *(concluído — migration 0020)*
- ✅ **Kanban de próteses** (`/admin/proteses`): solicitada → laboratório → retornou → instalada, ligado ao paciente, com datas automáticas e alerta de **Atrasada** (passou da previsão de retorno).

### C6 — Simulador de parcelamento 🟢 ✅ *(concluído — 2026-06-25)*
- ✅ Página `/admin/simulador` (link no Sidebar): valor + entrada (R$/%) + nº parcelas + juros (% a.m.); Tabela Price (parcelas fixas) com amortização; KPIs (parcelado/juros/total). Sem migration.

### C7 — Relatórios financeiros avançados 🟡 ✅ *(concluído)*
- ✅ **Fluxo de caixa com previsão/inadimplência** (aging), **ticket médio** e **distribuição de receita** por forma de pagamento, tudo no CSV/PDF de `/admin/relatorios`.

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

## Ordem recomendada (revisada 2026-07-06)
Quase todo o roadmap técnico foi entregue (ver "Entregue e em produção"). O que resta:
**LGPD → inputs OCR anamnese → C8 (migração + permissões) → [S7 quando a conta Meta sair] → F2 (futuro, ao vender pra 2ª clínica).**

Racional: o app já roda numa clínica real com dado de paciente em produção, então **LGPD vem primeiro** (exposição legal). Depois, ganhos de completude (OCR) e onboarding de dados reais (migração). **S7/WhatsApp** é o maior multiplicador e já foi iniciado como long-pole (aguarda conta Meta). **S10 convênios** está fora (a LCR não atende). **F3 rotação de segredos** fica pro lançamento.
