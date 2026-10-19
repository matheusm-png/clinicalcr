import { aiVisao } from "@/lib/ai";
import { montarPrompt } from "@/lib/ai/prompts";

// Leitura da FICHA COMPLETA (anamnese + procedimentos) a partir de imagens.
// Compartilhada entre /api/ai/importar-ficha (fotos enviadas na hora) e
// /api/ai/ler-captura (fotos já na fila do Storage, lidas em segundo plano).
// USO EXCLUSIVO NO SERVIDOR. Não loga o conteúdo extraído nem as imagens.

export type ProcLido = {
  data: string | null;
  descricao: string;
  dente: string | null;
  faces: Record<string, string> | null; // { "16": "MC" } — convertido para códigos na tela
  valorPago: number | null;
  pago: "sim" | "não" | null;
  nf: "sim" | "não" | null;
};

export type FichaLida = {
  dados: Record<string, unknown>;
  procedimentos: ProcLido[];
  revisar: string[];
};

// "sim"/"não" tolerante a variações ("s", "nao", true/false); senão null.
function parseSimNao(v: unknown): "sim" | "não" | null {
  if (typeof v === "boolean") return v ? "sim" : "não";
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  if (["sim", "s", "true", "1"].includes(s)) return "sim";
  if (["não", "nao", "n", "false", "0"].includes(s)) return "não";
  return null;
}

// Aceita number, "80,00", "R$ 80,00", "80.00" → 80. Caso contrário null.
function parseValor(v: unknown): number | null {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v !== "string") return null;
  const limpo = v.replace(/[^0-9.,-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = parseFloat(limpo);
  return isFinite(n) ? n : null;
}

export class LeituraInvalida extends Error {}

export async function lerFichaCompleta(dataUrls: string[]): Promise<FichaLida> {
  const prompt = montarPrompt("ocr-ficha-completa", {})!;
  // 4000 tokens: fichas com muitos procedimentos estouravam 2600 e o JSON vinha cortado.
  const saida = await aiVisao(dataUrls, prompt, { maxTokens: 4000, json: true });

  // Parse defensivo: remove cercas ```json e isola o primeiro objeto { ... }.
  let texto = saida.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const ini = texto.indexOf("{");
  const fim = texto.lastIndexOf("}");
  if (ini >= 0 && fim > ini) texto = texto.slice(ini, fim + 1);

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(texto);
  } catch {
    throw new LeituraInvalida("A IA não retornou um JSON válido. Tente fotos mais nítidas e bem enquadradas.");
  }

  // A IA pode devolver { anamnese, procedimentos } ou (fallback) os campos soltos.
  const anamnese = (parsed.anamnese && typeof parsed.anamnese === "object"
    ? parsed.anamnese
    : parsed) as Record<string, unknown>;

  const brutos = Array.isArray(parsed.procedimentos) ? (parsed.procedimentos as unknown[]) : [];
  const procedimentos: ProcLido[] = brutos
    .filter((p): p is Record<string, unknown> => !!p && typeof p === "object")
    .map((p) => ({
      data: p.data != null ? String(p.data) : null,
      descricao: p.descricao != null ? String(p.descricao) : "",
      dente: p.dente != null && String(p.dente).trim() !== "" ? String(p.dente).trim() : null,
      faces:
        p.faces && typeof p.faces === "object" && !Array.isArray(p.faces)
          ? Object.fromEntries(
              Object.entries(p.faces as Record<string, unknown>)
                .filter(([, v]) => v != null && String(v).trim() !== "")
                .map(([k, v]) => [k.replace(/\./g, ""), Array.isArray(v) ? v.join("") : String(v)]),
            )
          : null,
      valorPago: parseValor(p.valorPago),
      pago: parseSimNao(p.pago),
      nf: parseSimNao(p.nf),
    }))
    .filter((p) => p.descricao.trim() !== "" || p.valorPago != null);

  const revisar = Array.isArray(parsed._revisar) ? (parsed._revisar as unknown[]).map(String) : [];
  // Não vaza a estrutura interna de volta como "dado"
  delete anamnese._revisar;
  delete anamnese.procedimentos;

  return { dados: anamnese, procedimentos, revisar };
}
