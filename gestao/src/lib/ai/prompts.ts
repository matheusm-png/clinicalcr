import type { AiMessage } from "./index";

// Disclaimer padrão: a IA é apoio; a decisão é sempre do cirurgião-dentista.
const APOIO =
  "Lembre ao final, em uma linha, que esta análise é apenas um apoio e que a decisão clínica é do cirurgião-dentista responsável.";

export type AiTask =
  | "risco-anamnese"
  | "explicar-orcamento"
  | "redigir-mensagem"
  | "estruturar-evolucao"
  | "ocr-ficha-anamnese"
  | "ocr-ficha-completa";

// Campos que a ficha de papel da LCR contém — devem casar com o formulário digital.
const CAMPOS_FICHA = [
  "nome", "nascimento", "sexo", "tel", "endereco", "numero", "indicado_por", "profissao", "cpf", "identidade", "queixa",
  "febre_reumatica", "prob_cardiacos", "prob_cardiacos_desc", "prob_renais", "prob_gastricos", "prob_respiratorios",
  "prob_alergicos", "prob_articulares", "diabetes", "hipertensao", "gravidez", "fuma", "fuma_desc", "tratamento_medico", "medicacao",
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

    case "ocr-ficha-completa":
      return [
        {
          role: "system",
          content:
            "Você transcreve a FICHA COMPLETA de um paciente odontológico (fotografada, manuscrita) para dados estruturados. " +
            "A ficha tem DUAS partes: (A) FICHA DE ANAMNESE — dados pessoais e questionário de saúde; " +
            "(B) ODONTOGRAMA + tabela de PROCEDIMENTOS EXECUTADOS (colunas: Data | Procedimento executado | Assinatura), " +
            "às vezes com o valor pago anotado na margem (ex.: \"Pago 80,00\"). " +
            "As imagens podem conter uma ou ambas as partes. " +
            "RESPONDA APENAS com um objeto JSON válido (sem markdown, sem comentários, sem texto antes ou depois). " +
            "Estrutura EXATA do JSON:\n" +
            "{\n" +
            '  "anamnese": { ...campos abaixo... },\n' +
            '  "procedimentos": [ { "data": "dd/mm/aaaa", "descricao": "texto", "dente": "NN|null", "valorPago": number|null } ],\n' +
            '  "_revisar": [ "nomes.dos.campos.de.baixa.confianca" ]\n' +
            "}\n\n" +
            "Campos de \"anamnese\" (use EXATAMENTE estas chaves):\n" +
            JSON.stringify(CAMPOS_FICHA) +
            "\n\nRegras da anamnese:\n" +
            "- Sim/não (campos de saúde, hábitos, 'autoriza_fotos'): use a string \"sim\" ou \"não\" conforme marcado/escrito.\n" +
            "- Texto (nome, queixa, descrições _desc, observacoes etc.): transcreva o manuscrito EXATAMENTE como está, sem corrigir, completar ou inventar.\n" +
            "- CABEÇALHO — leia cada rótulo impresso e transcreva SÓ o que está escrito à frente dele. Os campos são distintos e NÃO devem ser trocados entre si: 'nome', 'nascimento', 'sexo', 'tel', 'endereco', 'profissao', 'indicado_por', 'identidade' (RG), 'cpf'.\n" +
            "  · 'endereco' = APENAS o logradouro (rua/av. e complemento), SEM o número. O número da casa (rótulo 'nº'/'N°') vai em 'numero', separado. Ex.: 'Rua Marquês' + numero '92'.\n" +
            "  · Se um rótulo estiver em branco, o valor é null — NÃO preencha com o conteúdo de outro campo vizinho.\n" +
            "  · Releia dígitos com cuidado (CPF, RG, telefone, número, datas): confira cada algarismo.\n" +
            "- 'nascimento': formato dd/mm/aaaa. 'sexo': \"M\" ou \"F\".\n" +
            "- Para campos '_desc': só preencha se o campo principal correspondente for \"sim\".\n" +
            "- NUNCA invente. Campo inexistente/em branco/ilegível → null (e cite em _revisar se tentou ler mas ficou em dúvida).\n\n" +
            "Regras dos procedimentos (parte B):\n" +
            "- Um item do array por LINHA preenchida da tabela. Se a tabela estiver vazia, use [].\n" +
            "- 'data': a data da linha em dd/mm/aaaa (ou null).\n" +
            "- 'descricao': o texto do procedimento executado, transcrito como está (ex.: \"Restauração palatina na unidade 23. RC A3\").\n" +
            "- 'dente': APENAS o número do dente (notação FDI, ex.: \"23\") se a descrição citar uma unidade/dente. Se citar vários, separe por vírgula (\"14,15\"). Se não citar, null. Não invente números.\n" +
            "- 'valorPago': o valor pago daquela linha como número (ex.: \"Pago 80,00\" → 80.0). Se não houver, null.\n\n" +
            "- Em \"_revisar\", liste os nomes dos campos/itens que você leu com baixa confiança (ilegível, rasura, ambiguidade). Ex.: \"anamnese.alergia\", \"procedimentos[0].valorPago\".\n" +
            "Dado de saúde de paciente: precisão e honestidade são obrigatórias — na dúvida, use null e liste em _revisar.",
        },
        {
          role: "user",
          content:
            "Transcreva esta ficha completa (anamnese + procedimentos) para o JSON especificado. Devolva somente o JSON.",
        },
      ];

    default:
      return null;
  }
}
