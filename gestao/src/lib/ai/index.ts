// ============================================================
// Camada de IA — provider-agnóstica (hoje: OpenAI via fetch).
// USO EXCLUSIVO NO SERVIDOR (Route Handlers / Server Actions).
// A OPENAI_API_KEY NUNCA pode ir pro cliente (sem NEXT_PUBLIC).
// Trocar de provider = reimplementar aqui, sem tocar no resto do app.
// ============================================================

export type AiMessage = { role: "system" | "user" | "assistant"; content: string };

const PROVIDER = process.env.AI_PROVIDER ?? "openai";
const CHAT_MODEL = process.env.AI_CHAT_MODEL ?? "gpt-4o-mini";
const TRANSCRIBE_MODEL = process.env.AI_TRANSCRIBE_MODEL ?? "whisper-1";
const VISION_MODEL = process.env.AI_VISION_MODEL ?? "gpt-4o-mini";

export function aiConfigurado(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

interface ChatOpts {
  maxTokens?: number;
  temperature?: number;
}

/** Conversa de texto. Retorna o conteúdo gerado. */
export async function aiChat(messages: AiMessage[], opts: ChatOpts = {}): Promise<string> {
  if (PROVIDER !== "openai") throw new Error(`Provider de IA não suportado: ${PROVIDER}`);
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY não configurada no servidor.");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages,
      max_tokens: opts.maxTokens ?? 700,
      temperature: opts.temperature ?? 0.4,
    }),
  });

  if (!res.ok) {
    const detalhe = await res.text().catch(() => "");
    throw new Error(`Falha na IA (${res.status}): ${detalhe.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

/**
 * Visão (multimodal): lê uma ou mais imagens + mensagens de texto e retorna o conteúdo gerado.
 * As imagens entram como data URLs (`data:image/...;base64,...`) anexadas à última mensagem do usuário.
 * USO EXCLUSIVO NO SERVIDOR. Não loga o conteúdo das imagens.
 */
export async function aiVisao(
  imagensDataUrl: string[],
  messages: AiMessage[],
  opts: ChatOpts = {},
): Promise<string> {
  if (PROVIDER !== "openai") throw new Error(`Provider de IA não suportado: ${PROVIDER}`);
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY não configurada no servidor.");
  if (!imagensDataUrl.length) throw new Error("Nenhuma imagem recebida para análise.");

  // Anexa as imagens à última mensagem 'user' (formato multimodal do Chat Completions).
  let ultimaUser = -1;
  messages.forEach((m, i) => {
    if (m.role === "user") ultimaUser = i;
  });
  const apiMessages = messages.map((m, i) => {
    if (i !== ultimaUser) return { role: m.role, content: m.content };
    return {
      role: m.role,
      content: [
        { type: "text", text: m.content },
        ...imagensDataUrl.map((url) => ({ type: "image_url", image_url: { url, detail: "high" } })),
      ],
    };
  });

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: VISION_MODEL,
      messages: apiMessages,
      max_tokens: opts.maxTokens ?? 1800,
      temperature: opts.temperature ?? 0.1,
    }),
  });

  if (!res.ok) {
    const detalhe = await res.text().catch(() => "");
    throw new Error(`Falha na IA de visão (${res.status}): ${detalhe.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

/** Transcrição de áudio (Whisper). Recebe um File/Blob de áudio. */
export async function aiTranscrever(audio: Blob, nomeArquivo = "audio.webm"): Promise<string> {
  if (PROVIDER !== "openai") throw new Error(`Provider de IA não suportado: ${PROVIDER}`);
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY não configurada no servidor.");

  const form = new FormData();
  form.append("file", audio, nomeArquivo);
  form.append("model", TRANSCRIBE_MODEL);
  form.append("language", "pt");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });

  if (!res.ok) {
    const detalhe = await res.text().catch(() => "");
    throw new Error(`Falha na transcrição (${res.status}): ${detalhe.slice(0, 300)}`);
  }
  const data = await res.json();
  return (data.text ?? "").trim();
}
