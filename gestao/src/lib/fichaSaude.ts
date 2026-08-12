// ============================================================
// FONTE ÚNICA da ordem das perguntas de saúde da FICHA DE PAPEL da LCR.
// Usada pela conferência do Importar Ficha, pelo wizard da anamnese digital
// e pela visualização de anamneses — para que a tela siga SEMPRE a mesma
// sequência do impresso (facilita conferir de cima para baixo).
// Se a ficha impressa mudar, ajuste AQUI (e só aqui).
// ============================================================

export type PerguntaSaude = {
  key: string;
  label: string;
  desc?: string;        // chave do campo de descrição (aparece quando a resposta é "sim")
  placeholder?: string; // dica do campo de descrição
};

// Bloco "Sofre de alguma das seguintes doenças?"
export const FICHA_DOENCAS: PerguntaSaude[] = [
  { key: "febre_reumatica", label: "Febre reumática" },
  { key: "prob_cardiacos", label: "Problemas cardíacos", desc: "prob_cardiacos_desc", placeholder: "Qual problema cardíaco?" },
  { key: "prob_renais", label: "Problemas renais", desc: "prob_renais_desc", placeholder: "Qual problema renal?" },
  { key: "prob_gastricos", label: "Problemas gástricos", desc: "prob_gastricos_desc", placeholder: "Qual problema gástrico?" },
  { key: "prob_respiratorios", label: "Problemas respiratórios", desc: "prob_respiratorios_desc", placeholder: "Qual? (ex.: asma)" },
  { key: "prob_alergicos", label: "Problemas alérgicos" },
  { key: "prob_articulares", label: "Problemas articulares ou reumatismo" },
  { key: "diabetes", label: "Diabetes" },
  { key: "hipertensao", label: "Hipertensão arterial" },
];

// Demais perguntas de saúde, na sequência do papel.
export const FICHA_GERAL: PerguntaSaude[] = [
  { key: "gravidez", label: "Gravidez" },
  { key: "fuma", label: "Fuma ou já fumou?", desc: "fuma_desc", placeholder: "O quê e quantidade por dia?" },
  { key: "tratamento_medico", label: "Está em tratamento médico atualmente?", desc: "tratamento_medico_desc", placeholder: "Qual tratamento?" },
  { key: "medicacao", label: "Está fazendo uso de alguma medicação?", desc: "medicacao_desc", placeholder: "Qual(is)?" },
  { key: "alergia", label: "Tem alergia?", desc: "alergia_desc", placeholder: "A quê?" },
  { key: "operado", label: "Já foi operado(a)?", desc: "operado_desc", placeholder: "Qual cirurgia?" },
  { key: "prob_cicatrizacao", label: "Teve problemas com a cicatrização?" },
  { key: "alergia_anestesia", label: "Teve problemas com a anestesia?", desc: "alergia_anestesia_desc", placeholder: "Descreva a reação" },
  { key: "prob_hemorragia", label: "Teve problemas de hemorragia?" },
];

export const FICHA_SAUDE_TODAS: PerguntaSaude[] = [...FICHA_DOENCAS, ...FICHA_GERAL];

// Ordem completa de exibição de uma anamnese preenchida (visualização):
// segue a ficha do início ao fim; chaves desconhecidas vão para o final.
export const ORDEM_FICHA: string[] = [
  "queixa",
  ...FICHA_SAUDE_TODAS.flatMap((q) => [q.key, ...(q.desc ? [q.desc] : [])]),
  // Bloco dental/hábitos (anamnese digital)
  "sangramento_gengiva", "ranger_dentes", "sensibilidade_frio_calor",
  "antecedentes_familiares", "ultima_vez_dentista", "higiene_oral",
  "habitos", "observacoes",
  "autorizacaoFoto", "autoriza_fotos",
  "profissao", "identidade", "indicado_por", "local_data",
];
