// ============================================================
// FONTE ÚNICA da FICHA DE ANAMNESE da LCR — ordem E rótulos.
//
// Transcrita literalmente de `DOCS/1. FICHA DE ANAMNESE essa.docx`
// (conferida contra as fichas escaneadas em `FICHA_PACIENTES/`).
//
// TODA tela que mostra ou pergunta anamnese deve ler daqui, na ordem daqui,
// com os rótulos daqui — wizard (admin/anamnese), visualização
// (AnamneseViewModal) e conferência do OCR (admin/importar-ficha).
// A dentista confere a tela contra o papel de cima para baixo: qualquer
// campo fora de posição, ou com nome diferente do impresso, é erro.
//
// Se a ficha impressa mudar, ajuste AQUI (e só aqui).
// ============================================================

export type PerguntaSaude = {
  key: string;
  label: string;
  desc?: string;        // chave do campo de descrição (aparece quando a resposta é "sim")
  placeholder?: string; // dica do campo de descrição
};

// ── Cabeçalho da ficha (identificação), na ordem impressa ────
// "Nome / Nascimento / Sexo / Tel / Endereço" · "Profissão / Indicado por"
// · "Identidade / CPF" · "Queixa principal e evolução da doença atual"
export const FICHA_IDENTIFICACAO: { key: string; label: string }[] = [
  { key: "nome", label: "Nome" },
  { key: "nascimento", label: "Nascimento" },
  { key: "sexo", label: "Sexo" },
  { key: "tel", label: "Tel" },
  { key: "endereco", label: "Endereço" },
  { key: "profissao", label: "Profissão" },
  { key: "indicado_por", label: "Indicado por" },
  { key: "identidade", label: "Identidade" },
  { key: "cpf", label: "CPF" },
];

export const FICHA_QUEIXA: PerguntaSaude = {
  key: "queixa",
  label: "Queixa principal e evolução da doença atual",
};

// ── "Questionário de Saúde — Sofre de alguma das seguintes doenças?" ──
// São estas OITO, nesta ordem. O papel não tem "Problemas alérgicos"
// (alergia é perguntada adiante, em "Tem alergia?").
export const FICHA_DOENCAS: PerguntaSaude[] = [
  { key: "febre_reumatica", label: "Febre Reumática" },
  { key: "prob_cardiacos", label: "Problemas cardíacos", desc: "prob_cardiacos_desc", placeholder: "Qual problema cardíaco?" },
  { key: "prob_renais", label: "Problemas renais", desc: "prob_renais_desc", placeholder: "Qual problema renal?" },
  { key: "prob_gastricos", label: "Problemas gástricos", desc: "prob_gastricos_desc", placeholder: "Qual problema gástrico?" },
  { key: "prob_respiratorios", label: "Problemas respiratórios", desc: "prob_respiratorios_desc", placeholder: "Qual? (ex.: asma)" },
  { key: "prob_articulares", label: "Problemas articulares ou reumatismo" },
  { key: "diabetes", label: "Diabetes" },
  { key: "hipertensao", label: "Hipertensão arterial" },
];

// ── Demais perguntas de saúde, na sequência do papel ─────────
// Atenção: "Teve problemas com a anestesia?" fica AQUI, entre cicatrização e
// hemorragia — é onde está no impresso.
export const FICHA_GERAL: PerguntaSaude[] = [
  { key: "gravidez", label: "Possibilidade/Gravidez" },
  { key: "fuma", label: "Fuma ou já fumou?", desc: "fuma_desc", placeholder: "O quê e quantidade por dia?" },
  { key: "tratamento_medico", label: "Está em tratamento médico atualmente?", desc: "tratamento_medico_desc", placeholder: "Qual tratamento?" },
  { key: "medicacao", label: "Está fazendo uso de alguma medicação?", desc: "medicacao_desc", placeholder: "Qual(is)?" },
  { key: "alergia", label: "Tem alergia?", desc: "alergia_desc", placeholder: "Qual(is)?" },
  { key: "operado", label: "Já foi operado?", desc: "operado_desc", placeholder: "Qual(is)?" },
  { key: "prob_cicatrizacao", label: "Teve problemas com a cicatrização?" },
  { key: "alergia_anestesia", label: "Teve problemas com a anestesia?", desc: "alergia_anestesia_desc", placeholder: "Descreva a reação" },
  { key: "prob_hemorragia", label: "Teve problemas de hemorragia?" },
];

export const FICHA_SAUDE_TODAS: PerguntaSaude[] = [...FICHA_DOENCAS, ...FICHA_GERAL];

// ── Campos de texto livre, na sequência do papel ─────────────
export const FICHA_TEXTO_LIVRE: { key: string; label: string; placeholder?: string }[] = [
  { key: "antecedentes_familiares", label: "Antecedentes familiares", placeholder: "Ex.: mãe diabética, pai hipertenso…" },
  { key: "ultima_vez_dentista", label: "Qual a última vez que foi ao dentista", placeholder: "Ex.: há 6 meses, ano passado…" },
  { key: "higiene_oral", label: "Como realiza sua higiene oral?", placeholder: "Ex.: escova 3x ao dia, usa fio dental…" },
  { key: "habitos", label: "Hábitos", placeholder: "Ex.: roer unhas, apertar objetos…" },
  { key: "observacoes", label: "Outras observações importantes", placeholder: "Outras observações clínicas relevantes…" },
];

// ── Rodapé da ficha ──────────────────────────────────────────
export const FICHA_RODAPE: { key: string; label: string }[] = [
  { key: "autorizacaoFoto", label: "Autorizo a realização de fotografias durante o atendimento e divulgação nas redes sociais @clinica.lcr" },
  { key: "local_data", label: "Local / Data" },
];

// ── Perguntas que NÃO constam na ficha de papel ──────────────
// Mantidas por utilidade clínica, mas sempre exibidas DEPOIS de tudo que é da
// ficha e sob um título próprio, para não bagunçar a conferência com o impresso.
// `prob_alergicos` é legado (já existe em anamneses antigas) e não é mais perguntado.
export const FICHA_COMPLEMENTAR: PerguntaSaude[] = [
  { key: "sangramento_gengiva", label: "Gengiva sangra durante a escovação?" },
  { key: "ranger_dentes", label: "Tem o hábito de ranger ou apertar os dentes (bruxismo)?" },
  { key: "sensibilidade_frio_calor", label: "Sente sensibilidade ao frio ou calor?" },
];

const LEGADO: { key: string; label: string }[] = [
  { key: "prob_alergicos", label: "Problemas alérgicos (campo antigo)" },
];

// ── Ordem completa de exibição de uma anamnese preenchida ────
// Segue a ficha do início ao fim; depois os complementares; chaves
// desconhecidas vão para o final.
export const ORDEM_FICHA: string[] = [
  ...FICHA_IDENTIFICACAO.map((c) => c.key),
  FICHA_QUEIXA.key,
  ...FICHA_SAUDE_TODAS.flatMap((q) => [q.key, ...(q.desc ? [q.desc] : [])]),
  ...FICHA_TEXTO_LIVRE.map((c) => c.key),
  ...FICHA_RODAPE.map((c) => c.key),
  "autoriza_fotos", // sinônimo antigo de autorizacaoFoto
  ...FICHA_COMPLEMENTAR.map((q) => q.key),
  ...LEGADO.map((q) => q.key),
];

// Posição de uma chave na ficha (para ordenar). Desconhecida → fim.
const POSICAO = new Map(ORDEM_FICHA.map((k, i) => [k, i]));
export const posicaoNaFicha = (key: string): number => POSICAO.get(key) ?? ORDEM_FICHA.length;

// ── Rótulos: um único mapa, com o texto do impresso ──────────
export const LABELS_FICHA: Record<string, string> = Object.fromEntries([
  ...FICHA_IDENTIFICACAO.map((c) => [c.key, c.label]),
  [FICHA_QUEIXA.key, FICHA_QUEIXA.label],
  ...FICHA_SAUDE_TODAS.map((q) => [q.key, q.label]),
  ...FICHA_TEXTO_LIVRE.map((c) => [c.key, c.label]),
  ...FICHA_RODAPE.map((c) => [c.key, c.label]),
  ["autoriza_fotos", "Autorizo o uso de fotografias"],
  ...FICHA_COMPLEMENTAR.map((q) => [q.key, q.label]),
  ...LEGADO.map((q) => [q.key, q.label]),
]);

// Rótulo de uma chave; desconhecida vira texto legível ("prob_x" → "Prob x").
export const rotuloFicha = (key: string): string =>
  LABELS_FICHA[key] ?? key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

// A chave faz parte da ficha de papel? (usado para separar o que é "extra")
const CHAVES_DA_FICHA = new Set<string>([
  ...FICHA_IDENTIFICACAO.map((c) => c.key),
  FICHA_QUEIXA.key,
  ...FICHA_SAUDE_TODAS.flatMap((q) => [q.key, ...(q.desc ? [q.desc] : [])]),
  ...FICHA_TEXTO_LIVRE.map((c) => c.key),
  ...FICHA_RODAPE.map((c) => c.key),
  "autoriza_fotos",
]);
export const ehCampoDaFicha = (key: string): boolean => CHAVES_DA_FICHA.has(key);
