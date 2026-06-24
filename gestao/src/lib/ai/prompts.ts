import type { AiMessage } from "./index";

// Disclaimer padrão: a IA é apoio; a decisão é sempre do cirurgião-dentista.
const APOIO =
  "Lembre ao final, em uma linha, que esta análise é apenas um apoio e que a decisão clínica é do cirurgião-dentista responsável.";

export type AiTask =
  | "risco-anamnese"
  | "explicar-orcamento"
  | "redigir-mensagem"
  | "estruturar-evolucao"
  | "ocr-ficha-anamnese";

// Campos que a ficha de papel da LCR contém — devem casar com o formulário digital.
const CAMPOS_FICHA = [
  "nome", "nascimento", "sexo", "tel", "endereco", "numero", "indicado_por", "profissao", "cpf", "identidade", "queixa",
  "febre_reumatica", "prob_cardiacos", "prob_cardiacos_desc", "prob_renais", "prob_gastricos", "prob_respiratorios",
  "prob_articulares", "diabetes", "hipertensao", "gravidez", "fuma", "fuma_desc", "tratamento_medico", "medicacao",
  "medicacao_desc", "alergia", "alergia_desc", "operado", "operado_desc", "prob_cicatrizacao", "alergia_anestesia",
  "alergia_anestesia_desc", "prob_hemorragia", "antecedentes_familiares", "ultima_vez_dentista", "higiene_oral",
  "habitos", "observacoes", "autoriza_fotos", "local_data",
];

/** Monta as mensagens (system+user) para cada tarefa. Retorna null se a task for inválida. */
export function montarPrompt(task: AiTask, input: any): AiMessage[] | null {
  switch (task) {
    case "risco-anamnese":
      return [
        {
          role: "system",
          content:
            "Você é um assistente clínico para cirurgiões-dentistas no Brasil. " +
            "A partir das respostas de anamnese, identifique ALERTAS relevantes para o atendimento odontológico: " +
            "condições sistêmicas (diabetes, hipertensão, cardiopatias), uso de anticoagulantes ou bifosfonatos, " +
            "alergias (especialmente a anestésicos, látex, AINEs/dipirona), risco de sangramento, " +
            "necessidade de profilaxia antibiótica, gravidez e interações medicamentosas. " +
            "Responda em português do Brasil, em tópicos curtos e objetivos. " +
            "Se não houver alertas evidentes, diga isso claramente. " +
            APOIO,
        },
        {
          role: "user",
          content: "Respostas da anamnese (JSON):\n" + JSON.stringify(input?.respostas ?? input, null, 2),
        },
      ];

    case "explicar-orcamento":
      return [
        {
          role: "system",
          content:
            "Você escreve para o PACIENTE de uma clínica odontológica, em português do Brasil, " +
            "com tom acolhedor, claro e honesto (sem prometer resultados nem pressionar). " +
            "Explique em linguagem simples o plano de tratamento: o que será feito, por que cada etapa importa " +
            "e o benefício para a saúde bucal. Não invente procedimentos além dos informados. " +
            "Texto curto (2 a 4 parágrafos), pronto para enviar.",
        },
        { role: "user", content: "Dados do orçamento (JSON):\n" + JSON.stringify(input, null, 2) },
      ];

    case "redigir-mensagem":
      return [
        {
          role: "system",
          content:
            "Você redige mensagens curtas e cordiais (WhatsApp) para pacientes de uma clínica odontológica, " +
            "em português do Brasil. Seja gentil e direto. Não use linguagem agressiva em cobranças. " +
            "Retorne apenas o texto da mensagem.",
        },
        {
          role: "user",
          content:
            `Tipo de mensagem: ${input?.tipo ?? "geral"}.\nContexto: ` +
            JSON.stringify(input?.contexto ?? input, null, 2),
        },
      ];

    case "estruturar-evolucao":
      return [
        {
          role: "system",
          content:
            "Você organiza anotações ditadas por um cirurgião-dentista em uma EVOLUÇÃO CLÍNICA objetiva, " +
            "em português do Brasil, na primeira pessoa do plural ou impessoal, com terminologia odontológica adequada. " +
            "Não invente dados que não foram ditos. Mantenha conciso e em texto corrido ou tópicos. " +
            "Retorne apenas a evolução.",
        },
        { role: "user", content: "Transcrição da fala:\n" + (input?.texto ?? String(input)) },
      ];

    case "ocr-ficha-anamnese":
      return [
        {
          role: "system",
          content:
            "Você transcreve fichas de ANAMNESE ODONTOLÓGICA manuscritas (fotografadas) para dados estruturados. " +
            "Leia com atenção a(s) imagem(ns) e extraia os campos abaixo. " +
            "RESPONDA APENAS com um objeto JSON válido (sem markdown, sem comentários, sem texto antes ou depois). " +
            "Use EXATAMENTE estas chaves:\n" +
            JSON.stringify(CAMPOS_FICHA) +
            "\n\nRegras de preenchimento:\n" +
            "- Campos de sim/não (todos os de saúde, hábitos e 'autoriza_fotos'): use a string \"sim\" ou \"não\" conforme o que estiver marcado/escrito.\n" +
            "- Campos de texto (nome, queixa, descrições _desc, observacoes etc.): transcreva o texto manuscrito como está.\n" +
            "- 'nascimento': se houver data, devolva no formato dd/mm/aaaa.\n" +
            "- 'sexo': \"M\" ou \"F\".\n" +
            "- NUNCA invente. Se um campo não existir na ficha, estiver em branco ou ilegível, use null.\n" +
            "- Para campos com '_desc' (descrição): só preencha se o campo principal correspondente for \"sim\".\n" +
            "- Inclua também a chave \"_revisar\": um array com os NOMES dos campos cujo valor você teve baixa confiança ao ler " +
            "(letra ilegível, rasura, ambiguidade marcado/não-marcado). Esses campos serão conferidos por um humano.\n" +
            "Dado de saúde de paciente: precisão e honestidade são obrigatórias — na dúvida, use null e liste em _revisar.",
        },
        {
          role: "user",
          content:
            "Transcreva esta ficha de anamnese para o JSON especificado. Devolva somente o JSON.",
        },
      ];

    default:
      return null;
  }
}
