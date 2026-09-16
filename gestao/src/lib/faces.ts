// Faces do dente — onde, no dente, o procedimento foi feito.
//
// Gravadas em procedimentos.faces (jsonb, migration 0033) como
// { "16": ["M","C"], "15": ["M","D"] }. Os códigos são canônicos; o rótulo
// muda com o dente (O vira I nos anteriores, L vira P nos superiores),
// igual à notação que a dentista já escreve no papel: "1.5(DM)".

export type Face = "M" | "D" | "O" | "V" | "L" | "C";
export type FacesPorDente = Record<string, Face[]>;

// Ordem de exibição (e do rótulo "MOD…").
export const FACES: Face[] = ["M", "O", "D", "V", "L", "C"];

const ANTERIORES = new Set([
  13, 12, 11, 21, 22, 23, 43, 42, 41, 31, 32, 33,
  53, 52, 51, 61, 62, 63, 83, 82, 81, 71, 72, 73,
]);

// Quadrante FDI: 1-4 permanentes, 5-8 decíduos.
const quadrante = (dente: string) => Number(String(dente).trim()[0]);

export const denteValido = (d: string) => {
  const n = Number(d);
  if (!/^\d{2}$/.test(d)) return false;
  const q = Math.floor(n / 10), u = n % 10;
  return (q >= 1 && q <= 4 && u >= 1 && u <= 8) || (q >= 5 && q <= 8 && u >= 1 && u <= 5);
};

export const ehAnterior = (dente: string) => ANTERIORES.has(Number(dente));
export const ehSuperior = (dente: string) => [1, 2, 5, 6].includes(quadrante(dente));
// No odontograma o lado direito do paciente fica à esquerda da tela; lá a
// mesial (face voltada para a linha média) aponta para a direita.
export const mesialADireita = (dente: string) => [1, 4, 5, 8].includes(quadrante(dente));

export function letraFace(face: Face, dente: string): string {
  if (face === "O") return ehAnterior(dente) ? "I" : "O";
  if (face === "L") return ehSuperior(dente) ? "P" : "L";
  return face;
}

export function nomeFace(face: Face, dente: string): string {
  switch (face) {
    case "M": return "Mesial";
    case "D": return "Distal";
    case "O": return ehAnterior(dente) ? "Incisal" : "Oclusal";
    case "V": return "Vestibular";
    case "L": return ehSuperior(dente) ? "Palatina" : "Lingual";
    case "C": return "Cervical";
  }
}

// Lista de dentes do texto livre "16, 15 e 14" / "1.6; 1.5" → ["16","15","14"].
export function dentesDoTexto(texto?: string | number): string[] {
  return String(texto ?? "")
    .split(/[,;/\s]+|\be\b/)
    .map((t) => t.replace(/\./g, "").trim())
    .filter(Boolean);
}

// Só as faces dos dentes que estão no procedimento, na ordem canônica.
export function limparFaces(faces: FacesPorDente | undefined, dentes: string[]): FacesPorDente {
  const out: FacesPorDente = {};
  dentes.forEach((d) => {
    const fs = faces?.[d]?.filter((f) => FACES.includes(f));
    if (fs && fs.length) out[d] = FACES.filter((f) => fs.includes(f));
  });
  return out;
}

// "MC" para o dente 16.
export const rotuloFaces = (dente: string, faces?: Face[]) =>
  (faces ?? []).map((f) => letraFace(f, dente)).join("");

// "16 (MC), 15 (MD)" — texto da coluna Dente.
export function denteComFaces(dente: string | number | undefined, faces?: FacesPorDente): string {
  const txt = String(dente ?? "").trim();
  if (!faces || Object.keys(faces).length === 0) return txt;
  const dentes = dentesDoTexto(txt);
  if (dentes.length === 0) return txt;
  return dentes.map((d) => (faces[d]?.length ? `${d} (${rotuloFaces(d, faces[d])})` : d)).join(", ");
}

// Texto digitado/lido → faces. Aceita "16 MC; 15 DM", "1.6(M) 1.5(DM)", "14-D".
// Letras do papel (I, P) voltam ao código canônico (O, L).
export function parseFaces(texto: string): FacesPorDente {
  const out: FacesPorDente = {};
  const re = /(\d)\.?(\d)\s*[-:(]?\s*([MDOIVLPCmdoivlpc]+)\)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto))) {
    const dente = m[1] + m[2];
    if (!denteValido(dente)) continue;
    const set = new Set<Face>(out[dente] ?? []);
    m[3].toUpperCase().split("").forEach((ch) => {
      const f = ch === "I" ? "O" : ch === "P" ? "L" : (ch as Face);
      if (FACES.includes(f)) set.add(f);
    });
    if (set.size) out[dente] = FACES.filter((f) => set.has(f));
  }
  return out;
}

// Faces → texto editável "16 MC; 15 MD" (inverso de parseFaces).
export const facesParaTexto = (faces?: FacesPorDente) =>
  Object.entries(faces ?? {})
    .filter(([, fs]) => fs.length)
    .map(([d, fs]) => `${d} ${rotuloFaces(d, fs)}`)
    .join("; ");

// Normaliza o que vem do banco/IA (jsonb solto) para FacesPorDente.
export function facesDoJson(v: unknown): FacesPorDente | undefined {
  if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
  const out: FacesPorDente = {};
  Object.entries(v as Record<string, unknown>).forEach(([d, fs]) => {
    if (!Array.isArray(fs)) return;
    const txt = fs.map(String).join("");
    const parsed = parseFaces(`${d} ${txt}`);
    if (parsed[d]) out[d] = parsed[d];
  });
  return Object.keys(out).length ? out : undefined;
}
