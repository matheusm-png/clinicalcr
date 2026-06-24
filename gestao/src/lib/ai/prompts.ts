import type { AiMessage } from "./index";

// Disclaimer padrão: a IA é apoio; a decisão é sempre do cirurgião-dentista.
const APOIO =
  "Lembre ao final, em uma linha, que esta análise é apenas um apoio e que a decisão clínica é do cirurgião-dentista responsável.";

export type AiTask = "risco-anamnese" | "explicar-orcamento" | "redigir-mensagem" | "estruturar-evolucao";

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

    default:
      return null;
  }
}
