"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { DB, usuarioAtual } from "@/lib/db";
import { CapturaLote, Paciente, Procedimento } from "@/lib/types";
import Topbar from "@/components/Topbar";
import Odontograma from "@/components/Odontograma";
import { useToast } from "@/components/Toast";
import { comprimirImagem } from "@/lib/imagem";
import { pdfParaImagens } from "@/lib/pdfParaImagens";
import {
  FICHA_DOENCAS, FICHA_GERAL, FICHA_IDENTIFICACAO, FICHA_QUEIXA, FICHA_RODAPE,
  FICHA_SAUDE_TODAS, FICHA_TEXTO_LIVRE,
} from "@/lib/fichaSaude";
import { dentesDoTexto, facesParaTexto, limparFaces, parseFaces } from "@/lib/faces";

// ── "Adicionar fichas" — fila + conferência ─────────────────────
// Feito para cadastrar MUITAS fichas de papel em sequência:
//  1. As fichas entram numa FILA (fotos do celular em "Capturar ficha", ou
//     fotos/PDFs escaneados enviados aqui). Uma ficha = uma pasta no Storage.
//  2. A IA lê cada ficha EM SEGUNDO PLANO (/api/ai/ler-captura → leitura.json).
//     Enquanto a dentista confere uma, as próximas já estão sendo lidas.
//  3. Conferência numa tela só: foto da ficha ao lado dos campos, na ordem do
//     papel (src/lib/fichaSaude.ts). "Salvar e próxima" já abre a seguinte.
// O que está sendo conferido fica salvo como rascunho neste navegador: sair
// da página ou fechar a aba não perde nada. Salvar é retomável — se der erro
// no meio, tentar de novo continua de onde parou (não duplica o paciente).

const hojeISO = () => new Date().toLocaleDateString("en-CA"); // yyyy-mm-dd no fuso local
const MAX_LEITURAS_SIMULTANEAS = 2;
// Ficha enviada pelo celular há menos que isso provavelmente já está sendo lida
// pelo próprio celular — esperamos antes de disparar outra leitura (evita pagar 2x).
const ESPERA_LEITURA_CELULAR_MS = 75_000;

const CATEGORIAS_ANEXO = [
  { valor: "raio-x", label: "Raio-X" },
  { valor: "documento", label: "Exame / documento" },
  { valor: "foto", label: "Foto" },
  { valor: "outro", label: "Outro" },
] as const;
type CatAnexo = (typeof CATEGORIAS_ANEXO)[number]["valor"];

type ProcRev = {
  data: string;        // yyyy-mm-dd (para o input date)
  descricao: string;
  dente: string;
  facesTxt: string;    // "16 MC; 15 DM" — editável; vira faces ao salvar
  valor: number;
  nfEmitida: boolean;
};
type AnexoPendente = { file: File; categoria: CatAnexo };

// Tudo que a dentista confere. `campos` usa as MESMAS chaves da ficha
// (fichaSaude.ts): identificação, queixa, saúde (+ _desc) e texto livre.
type Ficha = {
  campos: Record<string, string>;
  extras: Record<string, string>; // lidos pela IA sem campo próprio — preservados na anamnese
  dataFicha: string;
  autorizaFotos: boolean;
  procs: ProcRev[];
};
// Até onde o salvamento já foi — permite retomar sem duplicar.
type Progresso = { pacienteId?: number; anamnese?: boolean; procs: number };
type Rascunho = { ficha: Ficha; revisar: string[]; progresso: Progresso };

type ProcLido = { data?: unknown; descricao?: unknown; dente?: unknown; faces?: Record<string, string> | null; valorPago?: unknown; nf?: unknown };
type Leitura = { dados?: Record<string, unknown>; procedimentos?: ProcLido[]; revisar?: string[]; erro?: string };

const fichaVazia = (): Ficha => ({ campos: { sexo: "" }, extras: {}, dataFicha: "", autorizaFotos: false, procs: [] });

const brl = (v: number) =>
  "R$ " + (v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// dd/mm/aaaa (ou variações) → yyyy-mm-dd
const paraISO = (s?: unknown): string => {
  if (!s) return "";
  const t = String(s).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/(\d{1,2})\D(\d{1,2})\D(\d{2,4})/);
  if (!m) return "";
  const [, d, mo, ano] = m;
  const y = ano.length === 2 ? (Number(ano) > 40 ? "19" : "20") + ano : ano;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
};

const normSimNao = (v: unknown): "sim" | "não" | "" => {
  if (v == null) return "";
  if (typeof v === "boolean") return v ? "sim" : "não";
  const s = String(v).trim().toLowerCase();
  if (["sim", "s", "true", "1"].includes(s)) return "sim";
  if (["não", "nao", "n", "false", "0"].includes(s)) return "não";
  return "";
};

// Para achar paciente repetido: sem acento, minúsculo, espaços únicos.
const normNome = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
const soDigitos = (s?: string) => (s || "").replace(/\D/g, "");
const tituloNome = (s: string) => s.replace(/\b\p{L}/gu, (c) => c.toUpperCase());

// Leitura da IA → ficha editável.
function fichaDaLeitura(leitura: Leitura, label: string): { ficha: Ficha; revisar: string[] } {
  const d = (leitura.dados ?? {}) as Record<string, unknown>;
  const txt = (k: string) => (d[k] != null && d[k] !== "" ? String(d[k]) : "");
  const campos: Record<string, string> = {
    nome: txt("nome") || (label ? tituloNome(label) : ""),
    nascimento: paraISO(d.nascimento),
    sexo: (() => {
      const s = txt("sexo").toUpperCase();
      return s.startsWith("M") ? "M" : s.startsWith("F") ? "F" : "";
    })(),
    tel: txt("tel"),
    endereco: [d.endereco, d.numero].filter(Boolean).join(", "),
    profissao: txt("profissao"),
    indicado_por: txt("indicado_por"),
    identidade: txt("identidade"),
    // A IA às vezes cola texto vizinho no CPF ("pi Nota: 083.301.613-00") — fica só o número.
    cpf: txt("cpf").match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/)?.[0] ?? txt("cpf"),
    [FICHA_QUEIXA.key]: txt(FICHA_QUEIXA.key),
  };
  FICHA_SAUDE_TODAS.forEach(({ key, desc }) => {
    // Pergunta sem marcação no papel = "não" (é como a ficha é preenchida).
    campos[key] = normSimNao(d[key]) || "não";
    if (desc) campos[desc] = txt(desc);
  });
  FICHA_TEXTO_LIVRE.forEach(({ key }) => (campos[key] = txt(key)));

  // Rede de segurança: campo que a IA leu e não tem input próprio vai junto na anamnese.
  const conhecidos = new Set([...Object.keys(campos), "numero", "autoriza_fotos", "local_data"]);
  const extras: Record<string, string> = {};
  Object.entries(d).forEach(([k, v]) => {
    if (v == null || v === "" || conhecidos.has(k)) return;
    extras[k] = normSimNao(v) || String(v);
  });

  const procs: ProcRev[] = (leitura.procedimentos ?? []).map((p) => ({
    data: paraISO(p?.data),
    descricao: p?.descricao ? String(p.descricao) : "",
    dente: p?.dente != null ? String(p.dente) : "",
    facesTxt: p?.faces
      ? facesParaTexto(parseFaces(Object.entries(p.faces).map(([dt, f]) => `${dt} ${f}`).join("; ")))
      : "",
    valor: typeof p?.valorPago === "number" ? p.valorPago : Number(p?.valorPago) || 0,
    nfEmitida: normSimNao(p?.nf) === "sim",
  }));

  // A IA marca as dúvidas como "anamnese.cpf" / "procedimentos[0].data"; os campos
  // da tela usam só "cpf" — sem tirar o prefixo, nada ficava amarelo.
  const revisar = (leitura.revisar ?? []).map((k) => k.replace(/^anamnese\./, ""));

  // Data da anamnese não lida → sugere a do 1º procedimento (a anamnese é feita
  // na primeira consulta), marcada em amarelo para a dentista confirmar.
  let dataFicha = paraISO(d.local_data);
  if (!dataFicha) {
    const datas = procs.map((p) => p.data).filter(Boolean).sort();
    if (datas.length) {
      dataFicha = datas[0];
      if (!revisar.includes("local_data")) revisar.push("local_data");
    }
  }

  return {
    ficha: {
      campos,
      extras,
      dataFicha,
      autorizaFotos: normSimNao(d.autoriza_fotos) === "sim",
      procs,
    },
    revisar,
  };
}

// Rascunho local (por ficha da fila). localStorage pode falhar (aba anônima, cota).
const chaveRascunho = (pasta: string) => `lcr:ficha-rascunho:${pasta}`;
const lerRascunho = (pasta: string): Rascunho | null => {
  try {
    const s = localStorage.getItem(chaveRascunho(pasta));
    return s ? (JSON.parse(s) as Rascunho) : null;
  } catch {
    return null;
  }
};
const gravarRascunho = (pasta: string, r: Rascunho) => {
  try { localStorage.setItem(chaveRascunho(pasta), JSON.stringify(r)); } catch {}
};
const apagarRascunho = (pasta: string) => {
  try { localStorage.removeItem(chaveRascunho(pasta)); } catch {}
};

export default function AdicionarFichasPage() {
  const { showToast } = useToast();

  const [autor, setAutor] = useState("");
  const [clinicaId, setClinicaId] = useState<number | null>(null);
  const [pacientes, setPacientes] = useState<Paciente[]>([]);

  // ── Fila ──
  const [lotes, setLotes] = useState<CapturaLote[]>([]);
  const [carregouFila, setCarregouFila] = useState(false);
  const [leituras, setLeituras] = useState<Record<string, Leitura>>({});
  const [lendoAgora, setLendoAgora] = useState<Set<string>>(new Set());
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const enviadosAqui = useRef<Set<string>>(new Set()); // lidos já, sem esperar o celular
  // Espelhos para o carregarFila saber o que já baixou sem depender do estado.
  const leiturasRef = useRef(leituras);
  const thumbsRef = useRef(thumbs);
  useEffect(() => { leiturasRef.current = leituras; }, [leituras]);
  useEffect(() => { thumbsRef.current = thumbs; }, [thumbs]);
  const [salvosSessao, setSalvosSessao] = useState<{ id: number; nome: string }[]>([]);

  // ── Envio pelo computador ──
  const arqInputRef = useRef<HTMLInputElement | null>(null);
  const [fotosAvulsas, setFotosAvulsas] = useState<File[]>([]); // imagens aguardando "1 ficha ou várias?"
  const [enviando, setEnviando] = useState<string | null>(null);

  // ── Conferência ──
  const [fase, setFase] = useState<"fila" | "revisao">("fila");
  const [atual, setAtual] = useState<CapturaLote | null>(null);
  const [paginas, setPaginas] = useState<string[]>([]); // URLs assinadas das fotos da ficha atual
  const [pagina, setPagina] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [ficha, setFicha] = useState<Ficha>(fichaVazia());
  const [revisar, setRevisar] = useState<Set<string>>(new Set());
  const [progresso, setProgresso] = useState<Progresso>({ procs: 0 });
  const [anexos, setAnexos] = useState<AnexoPendente[]>([]);
  const [catAnexo, setCatAnexo] = useState<CatAnexo>("raio-x");
  const anexoInputRef = useRef<HTMLInputElement | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [abrindo, setAbrindo] = useState<string | null>(null);

  // ── Carregar fila ─────────────────────────────────────────
  const carregarFila = useCallback(async (cid: number) => {
    const lista = await DB.capturas.listar(cid).catch(() => [] as CapturaLote[]);
    // Mais antigas primeiro: a ordem em que foram fotografadas.
    lista.sort((a, b) => a.pasta.localeCompare(b.pasta));
    // Leituras novas (pequenos JSONs) e miniaturas que ainda não temos.
    const semLeitura = lista.filter((l) => l.temLeitura && !leiturasRef.current[l.pasta]);
    const semThumb = lista.filter((l) => !thumbsRef.current[l.pasta]);
    const [novasLeituras, novosThumbs] = await Promise.all([
      Promise.all(semLeitura.map(async (l) => [l.pasta, (await DB.capturas.leitura(cid, l.pasta)) ?? { erro: "Leitura ilegível." }] as const)),
      Promise.all(semThumb.map(async (l) => [l.pasta, (await DB.anexos.signedUrl(l.paths[0], 3600)) ?? ""] as const)),
    ]);
    if (novasLeituras.length) setLeituras((p) => ({ ...p, ...Object.fromEntries(novasLeituras) }));
    if (novosThumbs.length) setThumbs((p) => ({ ...p, ...Object.fromEntries(novosThumbs) }));
    setLotes(lista);
    setCarregouFila(true);
  }, []);

  useEffect(() => {
    (async () => {
      const u = await usuarioAtual();
      if (u?.nome) setAutor(u.nome);
      const c = await DB.clinica.get();
      setClinicaId(c?.id ?? null);
      if (c?.id) await carregarFila(c.id);
      else setCarregouFila(true);
      setPacientes(await DB.pacientes.list().catch(() => []));
    })();
  }, [carregarFila]);

  const statusLote = (l: CapturaLote): "lendo" | "pronta" | "erro" => {
    const lt = leituras[l.pasta];
    if (!l.temLeitura || !lt) return "lendo";
    return lt.erro ? "erro" : "pronta";
  };
  const prontas = lotes.filter((l) => statusLote(l) === "pronta");
  const pendentes = lotes.filter((l) => statusLote(l) === "lendo");

  // ── Leitura em segundo plano ──────────────────────────────
  // Trava síncrona: o estado `lendoAgora` só atualiza no próximo render, e o efeito
  // abaixo podia disparar a mesma ficha duas vezes (pagando a IA em dobro).
  const emLeitura = useRef<Set<string>>(new Set());
  const lerLote = useCallback(async (pasta: string, forcar = false) => {
    if (emLeitura.current.has(pasta)) return;
    emLeitura.current.add(pasta);
    setLendoAgora((s) => new Set(s).add(pasta));
    try {
      const res = await fetch("/api/ai/ler-captura", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pasta, forcar }),
      });
      if (forcar) setLeituras((p) => { const n = { ...p }; delete n[pasta]; return n; });
      if (!res.ok && res.status !== 502) {
        // 502 = a rota gravou o erro em leitura.json; outros (timeout da hospedagem) não gravaram nada.
        setLeituras((p) => ({ ...p, [pasta]: { erro: "O servidor demorou para responder." } }));
        setLotes((ls) => ls.map((l) => (l.pasta === pasta ? { ...l, temLeitura: true } : l)));
      }
    } catch {
      /* rede caiu — a próxima atualização da fila tenta de novo */
    } finally {
      emLeitura.current.delete(pasta);
      setLendoAgora((s) => { const n = new Set(s); n.delete(pasta); return n; });
      if (clinicaId) await carregarFila(clinicaId);
    }
  }, [clinicaId, carregarFila]);

  useEffect(() => {
    const vagas = MAX_LEITURAS_SIMULTANEAS - lendoAgora.size;
    if (vagas <= 0) return;
    const agora = Date.now();
    const aLer = lotes
      .filter((l) => !l.temLeitura && !lendoAgora.has(l.pasta))
      .filter((l) => enviadosAqui.current.has(l.pasta) || !l.quando || agora - new Date(l.quando).getTime() > ESPERA_LEITURA_CELULAR_MS)
      .slice(0, vagas);
    aLer.forEach((l) => lerLote(l.pasta));
  }, [lotes, lendoAgora, lerLote]);

  // Atualiza a fila sozinha (fichas chegando do celular, leituras terminando).
  useEffect(() => {
    if (!clinicaId || fase !== "fila") return;
    const t = setInterval(() => carregarFila(clinicaId), pendentes.length ? 8000 : 30000);
    return () => clearInterval(t);
  }, [clinicaId, fase, pendentes.length, carregarFila]);

  // ── Enviar fotos / PDFs pelo computador ───────────────────
  const enviarLote = async (blobs: Blob[], label: string) => {
    if (!clinicaId) throw new Error("Backend não conectado.");
    const pasta = await DB.capturas.enviar(clinicaId, blobs, label);
    enviadosAqui.current.add(pasta);
  };

  const onPickArquivos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arr = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!clinicaId) {
      showToast("Backend não conectado — não é possível enviar.", "error");
      return;
    }
    const pdfs = arr.filter((f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name));
    const imgs = arr.filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    let ok = 0;
    // Cada PDF = uma ficha (as páginas do PDF são as páginas da ficha).
    for (let i = 0; i < pdfs.length; i++) {
      setEnviando(`Preparando PDF ${i + 1} de ${pdfs.length}…`);
      try {
        const paginasPdf = await pdfParaImagens(pdfs[i]);
        if (!paginasPdf.length) throw new Error("PDF vazio");
        await enviarLote(paginasPdf, pdfs[i].name.replace(/\.pdf$/i, ""));
        ok++;
      } catch {
        showToast(`Não foi possível ler o PDF "${pdfs[i].name}".`, "error");
      }
    }
    setEnviando(null);
    if (ok) {
      showToast(`${ok} ficha(s) na fila. A IA já está lendo.`, "success");
      await carregarFila(clinicaId);
    }
    if (imgs.length) setFotosAvulsas((p) => [...p, ...imgs]);
  };

  // Fotos soltas: a dentista diz se são da mesma ficha ou de fichas diferentes.
  const enviarFotosAvulsas = async (modo: "uma" | "cada") => {
    if (!clinicaId) return;
    const grupos = modo === "uma" ? [fotosAvulsas.slice(0, 8)] : fotosAvulsas.map((f) => [f]);
    let ok = 0;
    for (let i = 0; i < grupos.length; i++) {
      setEnviando(`Enviando ficha ${i + 1} de ${grupos.length}…`);
      try {
        const blobs: Blob[] = [];
        for (const f of grupos[i]) blobs.push(await comprimirImagem(f));
        await enviarLote(blobs, "");
        ok++;
      } catch {
        showToast(`Falha ao enviar a ficha ${i + 1}.`, "error");
      }
    }
    setEnviando(null);
    setFotosAvulsas([]);
    if (ok) {
      showToast(`${ok} ficha(s) na fila. A IA já está lendo.`, "success");
      await carregarFila(clinicaId);
    }
  };

  const descartarDaFila = async (l: CapturaLote) => {
    if (!confirm("Tirar esta ficha da fila? As fotos enviadas serão apagadas (o papel continua com você).")) return;
    await DB.capturas.remover(l);
    apagarRascunho(l.pasta);
    setLotes((p) => p.filter((x) => x.pasta !== l.pasta));
  };

  // ── Abrir uma ficha para conferir ─────────────────────────
  const abrir = async (l: CapturaLote) => {
    if (!clinicaId) return;
    setAbrindo(l.pasta);
    try {
      const leitura = leituras[l.pasta] ?? (await DB.capturas.leitura(clinicaId, l.pasta)) ?? {};
      const rasc = lerRascunho(l.pasta);
      if (rasc) {
        setFicha(rasc.ficha);
        setRevisar(new Set(rasc.revisar));
        setProgresso(rasc.progresso ?? { procs: 0 });
      } else {
        const r = fichaDaLeitura(leitura, l.label);
        setFicha(r.ficha);
        setRevisar(new Set(r.revisar));
        setProgresso({ procs: 0 });
      }
      const urls = await Promise.all(l.paths.map((p) => DB.anexos.signedUrl(p, 3600)));
      setPaginas(urls.filter((u): u is string => !!u));
      setPagina(0);
      setZoom(false);
      setAnexos([]);
      setAtual(l);
      setFase("revisao");
      window.scrollTo({ top: 0 });
      if (rasc) showToast("Continuando de onde você parou.", "success");
    } catch {
      showToast("Não foi possível abrir esta ficha.", "error");
    } finally {
      setAbrindo(null);
    }
  };

  // Rascunho automático enquanto confere.
  useEffect(() => {
    if (fase !== "revisao" || !atual) return;
    const t = setTimeout(() => gravarRascunho(atual.pasta, { ficha, revisar: [...revisar], progresso }), 400);
    return () => clearTimeout(t);
  }, [fase, atual, ficha, revisar, progresso]);

  // A próxima pronta DEPOIS da atual na ordem da fila (senão, a primeira que sobrar) —
  // assim "Pular" anda pela fila em vez de ficar alternando entre as mesmas duas.
  const proximaPronta = (atualPasta?: string) =>
    prontas.find((l) => !atualPasta || l.pasta > atualPasta) ?? prontas.find((l) => l.pasta !== atualPasta);

  const voltarParaFila = () => {
    setFase("fila");
    setAtual(null);
    if (clinicaId) carregarFila(clinicaId);
  };

  const pular = () => {
    const prox = proximaPronta(atual?.pasta);
    if (prox) abrir(prox);
    else voltarParaFila();
  };

  // ── Edição ────────────────────────────────────────────────
  const setCampo = (k: string, v: string) => setFicha((f) => ({ ...f, campos: { ...f.campos, [k]: v } }));
  const setProc = (i: number, patch: Partial<ProcRev>) =>
    setFicha((f) => ({ ...f, procs: f.procs.map((x, idx) => (idx === i ? { ...x, ...patch } : x)) }));
  const addProc = () =>
    setFicha((f) => ({ ...f, procs: [...f.procs, { data: f.dataFicha || "", descricao: "", dente: "", facesTxt: "", valor: 0, nfEmitida: false }] }));
  const removerProc = (i: number) => setFicha((f) => ({ ...f, procs: f.procs.filter((_, idx) => idx !== i) }));

  const totalPago = useMemo(() => ficha.procs.reduce((s, p) => s + (p.valor || 0), 0), [ficha.procs]);

  const procsParaOdonto: Procedimento[] = useMemo(
    () =>
      ficha.procs
        .filter((p) => p.dente.trim() !== "")
        .map((p, i) => ({
          id: i,
          pacienteId: 0,
          dente: p.dente,
          faces: limparFaces(parseFaces(p.facesTxt), dentesDoTexto(p.dente)),
          procedimento: p.descricao || "Procedimento",
          custo: p.valor,
          status: "Concluído",
        })),
    [ficha.procs],
  );

  // Paciente que talvez já esteja cadastrado (mesmo nome ou mesmo CPF).
  const possiveisRepetidos = useMemo(() => {
    const n = normNome(ficha.campos.nome || "");
    const cpf = soDigitos(ficha.campos.cpf);
    if (!n && cpf.length !== 11) return [];
    return pacientes.filter(
      (p) => p.id !== progresso.pacienteId && ((n && normNome(p.nome) === n) || (cpf.length === 11 && soDigitos(p.cpf) === cpf)),
    );
  }, [ficha.campos.nome, ficha.campos.cpf, pacientes, progresso.pacienteId]);

  // ── Salvar (retomável) ────────────────────────────────────
  const salvar = async () => {
    if (!atual) return;
    const c = ficha.campos;
    const nome = (c.nome || "").trim();
    if (!nome) {
      showToast("Informe o nome do paciente.", "error");
      return;
    }
    if (possiveisRepetidos.length && !progresso.pacienteId) {
      const quem = possiveisRepetidos.map((p) => p.nome).join(", ");
      if (!confirm(`Já existe paciente cadastrado como "${quem}".\n\nSalvar mesmo assim como um paciente NOVO?\n(Cancelar para voltar e conferir.)`)) return;
    }
    setSalvando(true);
    const prog: Progresso = { ...progresso };
    try {
      // 1) Paciente
      if (!prog.pacienteId) {
        const [end, num] = (c.endereco || "").split(",").map((x) => x.trim());
        const pac = await DB.pacientes.save({
          nome,
          nascimento: c.nascimento || undefined,
          cpf: c.cpf || "",
          sexo: c.sexo || undefined,
          rg: c.identidade || undefined,
          tel: c.tel || "",
          endereco: end || undefined,
          numero: num || undefined,
          plano: "Particular",
          status: "Ativo",
        } as Paciente);
        prog.pacienteId = pac.id as number;
        setProgresso({ ...prog });
        // Consultas agendadas antes do cadastro existir ficam sem vínculo — liga pelo nome.
        try { await DB.agendamentos.vincularPorNome(prog.pacienteId, nome); } catch {}
      }
      const pacienteId = prog.pacienteId;

      // 2) Anamnese (respostas no mesmo formato da ficha digital)
      if (!prog.anamnese) {
        // Nome/nascimento/sexo/tel/endereço/CPF ficam no cadastro; o resto vai para a anamnese.
        const resto = Object.fromEntries(
          Object.entries(c).filter(([k]) => !["nome", "nascimento", "sexo", "tel", "endereco", "cpf"].includes(k)),
        );
        await DB.anamneses.save({
          pacienteId,
          respostas: {
            ...ficha.extras,
            ...resto,
            autorizacaoFoto: ficha.autorizaFotos,
            _origem: "importacao-foto",
            ...(autor ? { _autor: autor } : {}),
          },
          pacienteNome: nome,
          data: ficha.dataFicha || hojeISO(),
          status: "Assinado",
        });
        prog.anamnese = true;
        setProgresso({ ...prog });
      }

      // 3) Procedimentos + conta quitada (com flag NF) por procedimento pago
      const validos = ficha.procs.filter((p) => p.descricao.trim() || p.valor);
      for (let i = prog.procs; i < validos.length; i++) {
        const p = validos[i];
        await DB.procedimentos.save({
          pacienteId,
          dente: p.dente || "",
          faces: limparFaces(parseFaces(p.facesTxt), dentesDoTexto(p.dente)),
          procedimento: p.descricao.trim() || "Procedimento",
          custo: p.valor || 0,
          status: "Concluído",
          data: p.data || ficha.dataFicha || undefined,
          pago: p.valor > 0,
          nfEmitida: p.nfEmitida,
        } as Procedimento);
        if (p.valor > 0) {
          await DB.contas.criar(
            { pacienteId, descricao: p.descricao.trim() || "Procedimento", valorTotal: p.valor, status: "quitada", nfEmitida: p.nfEmitida },
            [{ numero: 1, valor: p.valor, pago: true, pagoEm: p.data || ficha.dataFicha || undefined }],
          );
        }
        prog.procs = i + 1;
        setProgresso({ ...prog });
      }

      // 4) Anexos (raio-x / exames) — falha aqui não desfaz o resto
      let anexosOk = 0;
      if (anexos.length && clinicaId) {
        for (const a of anexos) {
          try {
            await DB.anexos.upload(pacienteId, clinicaId, a.file, a.categoria, autor);
            anexosOk++;
          } catch {
            showToast(`Falha ao anexar "${a.file.name}" — anexe depois pelo prontuário.`, "error");
          }
        }
      }

      // 5) Tira da fila e segue para a próxima
      await DB.capturas.remover(atual);
      apagarRascunho(atual.pasta);
      const feito = atual.pasta;
      setLotes((p) => p.filter((l) => l.pasta !== feito));
      setSalvosSessao((s) => [...s, { id: pacienteId, nome }]);
      setPacientes((p) => [...p, { id: pacienteId, nome, cpf: c.cpf || "", tel: c.tel || "", plano: "Particular", status: "Ativo" }]);
      showToast(`✓ ${nome} salvo${validos.length ? ` com ${validos.length} procedimento(s)` : ""}${anexosOk ? ` e ${anexosOk} anexo(s)` : ""}.`, "success");

      const prox = proximaPronta(feito);
      if (prox) await abrir(prox);
      else voltarParaFila();
    } catch (err) {
      showToast(
        (err instanceof Error ? err.message : "Não foi possível salvar.") +
          " Nada foi perdido — clique em salvar de novo para continuar de onde parou.",
        "error",
      );
    } finally {
      setSalvando(false);
    }
  };

  const descartarAtual = async () => {
    if (!atual) return;
    if (progresso.pacienteId) {
      showToast("Esta ficha já foi salva em parte — termine de salvar ou corrija pelo prontuário.", "error");
      return;
    }
    if (!confirm("Descartar esta ficha? As fotos saem da fila e o que você conferiu é perdido.")) return;
    await DB.capturas.remover(atual);
    apagarRascunho(atual.pasta);
    const feito = atual.pasta;
    setLotes((p) => p.filter((l) => l.pasta !== feito));
    const prox = proximaPronta(feito);
    if (prox) await abrir(prox);
    else voltarParaFila();
  };

  // ── UI ────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "8px 10px", borderRadius: 8,
    border: "1px solid var(--border)", background: "var(--bg)", fontSize: 14,
  };
  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 3, display: "block" };
  const rev = (k: string): React.CSSProperties =>
    revisar.has(k) ? { borderColor: "#F59E0B", background: "#FFFBEB" } : {};

  // Uma pergunta de saúde (label + Sim/Não + descrição quando "sim").
  const renderCampoSaude = (key: string, label: string, desc?: string, placeholder?: string) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 13, ...(revisar.has(key) ? { color: "#B45309", fontWeight: 600 } : {}) }}>{label}</span>
        <div style={{ display: "flex", flexShrink: 0, borderRadius: 6, overflow: "hidden", border: "1px solid var(--border)", ...rev(key) }}>
          {(["não", "sim"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setCampo(key, v)}
              style={{
                padding: "3px 10px", fontSize: 12.5, fontWeight: 600, border: "none", cursor: "pointer",
                background: (ficha.campos[key] ?? "não") === v ? (v === "sim" ? "var(--danger)" : "var(--primary)") : "transparent",
                color: (ficha.campos[key] ?? "não") === v ? "#fff" : "var(--text-muted)",
              }}
            >{v === "sim" ? "Sim" : "Não"}</button>
          ))}
        </div>
      </div>
      {desc && ficha.campos[key] === "sim" && (
        <input
          placeholder={placeholder || "Qual(is)?"}
          value={ficha.campos[desc] ?? ""}
          onChange={(e) => setCampo(desc, e.target.value)}
          style={{ ...inputStyle, padding: "5px 9px", fontSize: 13, ...rev(desc) }}
        />
      )}
    </div>
  );

  // Campo da identificação, conforme o tipo.
  const renderIdent = (key: string, label: string) => {
    const largo = key === "nome" || key === "endereco";
    let input: React.ReactNode;
    if (key === "nascimento") {
      input = <input type="date" style={{ ...inputStyle, ...rev(key) }} value={ficha.campos.nascimento || ""} onChange={(e) => setCampo(key, e.target.value)} />;
    } else if (key === "sexo") {
      input = (
        <select style={{ ...inputStyle, ...rev(key) }} value={ficha.campos.sexo || ""} onChange={(e) => setCampo(key, e.target.value)}>
          <option value="">—</option><option value="F">Feminino</option><option value="M">Masculino</option>
        </select>
      );
    } else {
      input = <input style={{ ...inputStyle, ...rev(key) }} value={ficha.campos[key] || ""} onChange={(e) => setCampo(key, e.target.value)} />;
    }
    return (
      <div key={key} style={largo ? { gridColumn: "1 / -1" } : undefined}>
        <label style={labelStyle}>{label}{key === "nome" ? " *" : ""}</label>
        {input}
      </div>
    );
  };

  const fmtQuando = (iso: string) =>
    iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";

  return (
    <>
      <Topbar title="Adicionar fichas" />
      <style>{`
        .af-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr); gap: 16px; align-items: start; }
        .af-foto { position: sticky; top: 12px; }
        .af-procs { display: grid; grid-template-columns: 128px minmax(150px, 1fr) 70px 110px 100px 36px 28px; gap: 6px; align-items: center; }
        @media (max-width: 960px) {
          .af-grid { grid-template-columns: 1fr; }
          .af-foto { position: static; }
          .af-procs { grid-template-columns: 1fr 1fr; }
          .af-procs .af-desc { grid-column: 1 / -1; }
        }
      `}</style>
      <main className="page-content">

        {/* ═════════════ FILA ═════════════ */}
        {fase === "fila" && (
          <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Resumo + ação principal */}
            <div className="card" style={{ padding: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
                  {!carregouFila ? "Carregando fila…"
                    : prontas.length ? `${prontas.length} ficha${prontas.length === 1 ? "" : "s"} pronta${prontas.length === 1 ? "" : "s"} para conferir`
                    : pendentes.length ? "A IA está lendo as fichas…"
                    : "Nenhuma ficha na fila"}
                </h2>
                <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  {pendentes.length > 0 && <>{pendentes.length} sendo lida{pendentes.length === 1 ? "" : "s"} pela IA · </>}
                  {salvosSessao.length > 0 ? <strong style={{ color: "var(--success)" }}>{salvosSessao.length} salva{salvosSessao.length === 1 ? "" : "s"} agora</strong> : "Envie fotos ou PDFs das fichas — a IA lê sozinha e você só confere."}
                </p>
              </div>
              {prontas.length > 0 && (
                <button className="btn btn-primary" style={{ fontSize: 15, padding: "12px 22px" }} onClick={() => abrir(prontas[0])} disabled={!!abrindo}>
                  {abrindo ? "Abrindo…" : "Começar a conferir →"}
                </button>
              )}
            </div>

            {/* Adicionar à fila */}
            <div className="card" style={{ padding: 20 }}>
              <input ref={arqInputRef} type="file" accept="image/*,application/pdf,.pdf,.heic" multiple hidden onChange={onPickArquivos} />
              {fotosAvulsas.length === 0 ? (
                <div
                  onClick={() => !enviando && arqInputRef.current?.click()}
                  style={{ border: "2px dashed var(--border)", borderRadius: 12, padding: "26px 20px", textAlign: "center", cursor: enviando ? "wait" : "pointer", background: "var(--bg2)" }}
                >
                  <div style={{ fontSize: 28, marginBottom: 4 }}>📄</div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{enviando || "Adicionar fichas à fila"}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                    Fotos ou PDFs escaneados · pode escolher vários de uma vez · cada PDF vira uma ficha
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>{fotosAvulsas.length} foto{fotosAvulsas.length === 1 ? "" : "s"} selecionada{fotosAvulsas.length === 1 ? "" : "s"}. Elas são…</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                    {fotosAvulsas.slice(0, 12).map((f, i) => (
                      <span key={i} className="badge badge-neutral" style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                    ))}
                    {fotosAvulsas.length > 12 && <span className="badge badge-neutral">+{fotosAvulsas.length - 12}</span>}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="btn btn-primary" disabled={!!enviando} onClick={() => enviarFotosAvulsas("uma")}>
                      Páginas da MESMA ficha{fotosAvulsas.length > 8 ? " (até 8)" : ""}
                    </button>
                    {fotosAvulsas.length > 1 && (
                      <button className="btn" style={{ border: "1px solid var(--border)" }} disabled={!!enviando} onClick={() => enviarFotosAvulsas("cada")}>
                        Cada foto é uma ficha diferente
                      </button>
                    )}
                    <button className="btn" disabled={!!enviando} onClick={() => setFotosAvulsas([])}>Cancelar</button>
                  </div>
                  {enviando && <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 8 }}>{enviando}</div>}
                </div>
              )}
              <div style={{ marginTop: 12, fontSize: 12.5, color: "var(--text-muted)" }}>
                📱 No celular, use <Link href="/admin/capturar" style={{ fontWeight: 600 }}>Capturar ficha</Link>: fotografe e envie uma atrás da outra — elas aparecem aqui já lidas.
              </div>
            </div>

            {/* Lista */}
            {lotes.length > 0 && (
              <div className="card" style={{ padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700 }}>Fila ({lotes.length})</h3>
                  <button className="btn btn-sm btn-outline" onClick={() => clinicaId && carregarFila(clinicaId)}>Atualizar</button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {lotes.map((l) => {
                    const st = statusLote(l);
                    const lt = leituras[l.pasta];
                    const nomeLido = lt?.dados?.nome ? String(lt.dados.nome) : "";
                    const temRasc = typeof window !== "undefined" && !!lerRascunho(l.pasta);
                    return (
                      <div key={l.pasta} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg2)" }}>
                        {thumbs[l.pasta] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={thumbs[l.pasta]} alt="" style={{ width: 46, height: 46, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)", flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: 46, height: 46, borderRadius: 8, background: "var(--bg)", display: "grid", placeItems: "center", flexShrink: 0 }}>📄</div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {nomeLido || l.label || "Ficha sem nome"}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                            {l.paths.length} página{l.paths.length === 1 ? "" : "s"}{l.quando ? ` · ${fmtQuando(l.quando)}` : ""}
                            {temRasc && <> · <span style={{ color: "var(--primary)", fontWeight: 600 }}>conferência em andamento</span></>}
                          </div>
                        </div>
                        {st === "lendo" && <span className="badge badge-neutral" style={{ flexShrink: 0 }}>⏳ Lendo…</span>}
                        {st === "erro" && (
                          <>
                            <span className="badge" style={{ flexShrink: 0, background: "#FEF2F2", color: "var(--danger)" }} title={lt?.erro}>Não deu pra ler</span>
                            <button className="btn btn-sm btn-outline" style={{ flexShrink: 0 }} disabled={lendoAgora.has(l.pasta)} onClick={() => lerLote(l.pasta, true)}>
                              {lendoAgora.has(l.pasta) ? "Lendo…" : "Tentar de novo"}
                            </button>
                            <button className="btn btn-sm" style={{ flexShrink: 0, border: "1px solid var(--border)" }} onClick={() => abrir(l)}>Digitar à mão</button>
                          </>
                        )}
                        {st === "pronta" && (
                          <button className="btn btn-primary btn-sm" style={{ flexShrink: 0 }} onClick={() => abrir(l)} disabled={!!abrindo}>
                            {abrindo === l.pasta ? "Abrindo…" : "Conferir"}
                          </button>
                        )}
                        <button className="icon-btn danger" title="Tirar da fila" onClick={() => descartarDaFila(l)} style={{ flexShrink: 0 }}>
                          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {salvosSessao.length > 0 && (
              <div className="card" style={{ padding: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Salvos agora</h3>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {salvosSessao.map((s) => (
                    <Link key={s.id} href={`/admin/prontuario?id=${s.id}`} className="badge badge-neutral" style={{ textDecoration: "none" }}>✓ {s.nome}</Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═════════════ CONFERÊNCIA ═════════════ */}
        {fase === "revisao" && atual && (
          <div style={{ maxWidth: 1400, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
              <button className="btn btn-sm" style={{ border: "1px solid var(--border)" }} onClick={voltarParaFila} disabled={salvando}>← Fila</button>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                {prontas.length > 1 ? `Mais ${prontas.length - 1} pronta${prontas.length - 1 === 1 ? "" : "s"} depois desta` : "Última ficha pronta da fila"}
                {pendentes.length ? ` · ${pendentes.length} sendo lida${pendentes.length === 1 ? "" : "s"}` : ""}
                {salvosSessao.length ? ` · ${salvosSessao.length} salva${salvosSessao.length === 1 ? "" : "s"}` : ""}
              </span>
            </div>

            <div className="af-grid">
              {/* ── Foto da ficha ── */}
              <div className="af-foto card" style={{ padding: 10 }}>
                {paginas.length > 1 && (
                  <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                    {paginas.map((_, i) => (
                      <button key={i} className="btn btn-sm" onClick={() => { setPagina(i); setZoom(false); }}
                        style={{ border: `1px solid ${pagina === i ? "var(--primary)" : "var(--border)"}`, background: pagina === i ? "var(--primary-light)" : "transparent" }}>
                        Página {i + 1}
                      </button>
                    ))}
                  </div>
                )}
                <div style={{ maxHeight: "calc(100vh - 170px)", overflow: "auto", borderRadius: 8, background: "var(--bg2)" }}>
                  {paginas[pagina] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={paginas[pagina]} alt={`Ficha — página ${pagina + 1}`}
                      onClick={() => setZoom((z) => !z)}
                      style={{ display: "block", width: zoom ? "200%" : "100%", maxWidth: "none", cursor: zoom ? "zoom-out" : "zoom-in" }}
                    />
                  ) : (
                    <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Carregando foto…</div>
                  )}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6, display: "flex", justifyContent: "space-between" }}>
                  <span>Clique na foto para ampliar</span>
                  {paginas[pagina] && <a href={paginas[pagina]} target="_blank" rel="noreferrer">Abrir em nova aba ↗</a>}
                </div>
              </div>

              {/* ── Campos ── */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
                {leituras[atual.pasta]?.erro && !progresso.pacienteId && (
                  <div className="card" style={{ padding: "10px 14px", borderLeft: "3px solid var(--danger)", fontSize: 13 }}>
                    A IA não conseguiu ler esta ficha — preencha olhando a foto.
                  </div>
                )}
                {revisar.size > 0 && (
                  <div className="card" style={{ padding: "10px 14px", borderLeft: "3px solid #F59E0B", background: "#FFFBEB", fontSize: 13 }}>
                    <strong>{revisar.size} campo(s)</strong> em que a IA ficou em dúvida estão em amarelo — confira esses com atenção.
                  </div>
                )}
                {possiveisRepetidos.length > 0 && (
                  <div className="card" style={{ padding: "10px 14px", borderLeft: "3px solid var(--danger)", background: "#FEF2F2", fontSize: 13 }}>
                    <strong>Atenção: parece que este paciente já está cadastrado</strong> —{" "}
                    {possiveisRepetidos.map((p, i) => (
                      <React.Fragment key={p.id}>
                        {i > 0 && ", "}
                        <a href={`/admin/prontuario?id=${p.id}`} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>{p.nome}</a>
                      </React.Fragment>
                    ))}
                    . Se for a mesma pessoa, descarte esta ficha.
                  </div>
                )}
                {progresso.pacienteId && (
                  <div className="card" style={{ padding: "10px 14px", borderLeft: "3px solid var(--primary)", fontSize: 13 }}>
                    O salvamento parou no meio. Clique em <strong>Salvar e próxima</strong> para terminar — o paciente não será duplicado.
                  </div>
                )}

                {/* Identificação + queixa — ordem do papel */}
                <section className="card" style={{ padding: 18 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Ficha de anamnese</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
                    {FICHA_IDENTIFICACAO.map(({ key, label }) => renderIdent(key, label))}
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label style={labelStyle}>{FICHA_QUEIXA.label}</label>
                      <input style={{ ...inputStyle, ...rev(FICHA_QUEIXA.key) }} value={ficha.campos[FICHA_QUEIXA.key] || ""} onChange={(e) => setCampo(FICHA_QUEIXA.key, e.target.value)} />
                    </div>
                  </div>
                </section>

                {/* Questionário de saúde */}
                <section className="card" style={{ padding: 18 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Questionário de Saúde — Sofre de alguma das seguintes doenças?</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "8px 24px" }}>
                    {FICHA_DOENCAS.map(({ key, label, desc, placeholder }) => (
                      <React.Fragment key={key}>{renderCampoSaude(key, label, desc, placeholder)}</React.Fragment>
                    ))}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
                    {FICHA_GERAL.map(({ key, label, desc, placeholder }) => (
                      <React.Fragment key={key}>{renderCampoSaude(key, label, desc, placeholder)}</React.Fragment>
                    ))}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10, marginTop: 16 }}>
                    {FICHA_TEXTO_LIVRE.map(({ key, label }) => (
                      <div key={key}>
                        <label style={labelStyle}>{label}</label>
                        <input style={{ ...inputStyle, ...rev(key) }} value={ficha.campos[key] || ""} onChange={(e) => setCampo(key, e.target.value)} />
                      </div>
                    ))}
                  </div>
                  <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 14, fontSize: 13, cursor: "pointer" }}>
                    <input type="checkbox" checked={ficha.autorizaFotos} onChange={(e) => setFicha((f) => ({ ...f, autorizaFotos: e.target.checked }))} style={{ marginTop: 3 }} />
                    {FICHA_RODAPE[0].label}
                  </label>
                  <div style={{ marginTop: 12 }}>
                    <label style={labelStyle}>{FICHA_RODAPE[1].label} (data da anamnese)</label>
                    <input type="date" style={{ ...inputStyle, maxWidth: 200, ...rev("local_data") }} value={ficha.dataFicha} max={hojeISO()} onChange={(e) => setFicha((f) => ({ ...f, dataFicha: e.target.value }))} />
                    {!ficha.dataFicha ? (
                      <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginTop: 3 }}>
                        Não foi lida na ficha — se ficar vazia, salva com a data de hoje.
                      </span>
                    ) : revisar.has("local_data") && (
                      <span style={{ fontSize: 11, color: "#B45309", display: "block", marginTop: 3 }}>
                        Confira: a IA não leu com certeza (se não leu, sugerimos a data do 1º procedimento).
                      </span>
                    )}
                  </div>
                </section>

                {/* Procedimentos (dente, faces, data, valor, NF numa linha só) */}
                <section className="card" style={{ padding: 18 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 8 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700 }}>Procedimentos executados</h3>
                    <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Total pago: <strong style={{ color: "var(--success)" }}>{brl(totalPago)}</strong></span>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
                    Cada linha vira um procedimento concluído; com valor, também um recebimento quitado. Marque NF se houve nota fiscal.
                  </p>
                  {ficha.procs.length > 0 && (
                    <div className="af-procs" style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                      <span>Data</span><span className="af-desc">Procedimento</span><span>Dente</span><span>Faces</span><span>Valor pago</span><span>NF</span><span />
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {ficha.procs.map((p, i) => (
                      <div key={i} className="af-procs" style={{ padding: 6, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg2)" }}>
                        <input type="date" title="Data" value={p.data} onChange={(e) => setProc(i, { data: e.target.value })} style={{ ...inputStyle, padding: "6px 6px", fontSize: 13, ...rev(`procedimentos[${i}].data`) }} />
                        <input className="af-desc" placeholder="Procedimento executado" value={p.descricao} onChange={(e) => setProc(i, { descricao: e.target.value })} style={{ ...inputStyle, padding: "6px 8px", fontSize: 13, ...rev(`procedimentos[${i}].descricao`) }} />
                        <input placeholder="Dente" title="Nº do dente (FDI). Vários? separe por vírgula" value={p.dente} onChange={(e) => setProc(i, { dente: e.target.value })} style={{ ...inputStyle, padding: "6px 6px", fontSize: 13, textAlign: "center", ...rev(`procedimentos[${i}].dente`) }} />
                        <input placeholder="16 MC" title="Faces por dente: M, D, O/I, V, L/P, C. Ex.: 16 MC; 15 DM" value={p.facesTxt} onChange={(e) => setProc(i, { facesTxt: e.target.value.toUpperCase() })} style={{ ...inputStyle, padding: "6px 6px", fontSize: 13, ...rev(`procedimentos[${i}].faces`) }} />
                        <input type="number" step="0.01" placeholder="0,00" value={p.valor || ""} onChange={(e) => setProc(i, { valor: Number(e.target.value) || 0 })} style={{ ...inputStyle, padding: "6px 6px", fontSize: 13, ...rev(`procedimentos[${i}].valorPago`) }} />
                        <input type="checkbox" title="Nota fiscal emitida?" checked={p.nfEmitida} onChange={(e) => setProc(i, { nfEmitida: e.target.checked })} style={{ justifySelf: "center" }} />
                        <button onClick={() => removerProc(i)} title="Remover" style={{ border: "none", background: "transparent", color: "var(--danger)", cursor: "pointer", fontSize: 18 }}>×</button>
                      </div>
                    ))}
                  </div>
                  {ficha.procs.length === 0 && (
                    <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "6px 0" }}>Nenhum procedimento lido na ficha.</div>
                  )}
                  <button onClick={addProc} className="btn btn-sm" style={{ marginTop: 10, border: "1px dashed var(--border)" }}>+ Adicionar procedimento</button>

                  {procsParaOdonto.length > 0 && (
                    <details style={{ marginTop: 14 }}>
                      <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>Ver no odontograma</summary>
                      <div style={{ pointerEvents: "none", marginTop: 10 }}>
                        <Odontograma procedimentos={procsParaOdonto} selectedTeeth={new Set()} onSelectTeeth={() => {}} onDenteClick={() => {}} />
                      </div>
                    </details>
                  )}
                </section>

                {/* Anexos */}
                <details className="card" style={{ padding: 18 }}>
                  <summary style={{ cursor: "pointer", fontSize: 15, fontWeight: 700 }}>
                    Anexos (raio-x, exames) <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-muted)" }}>— opcional{anexos.length ? ` · ${anexos.length} arquivo(s)` : ""}</span>
                  </summary>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", margin: "12px 0" }}>
                    <select value={catAnexo} onChange={(e) => setCatAnexo(e.target.value as CatAnexo)} style={{ ...inputStyle, width: "auto" }}>
                      {CATEGORIAS_ANEXO.map((c) => <option key={c.valor} value={c.valor}>{c.label}</option>)}
                    </select>
                    <input ref={anexoInputRef} type="file" multiple hidden onChange={(e) => {
                      const arr = Array.from(e.target.files ?? []);
                      if (arr.length) setAnexos((p) => [...p, ...arr.map((file) => ({ file, categoria: catAnexo }))]);
                      e.target.value = "";
                    }} />
                    <button className="btn btn-sm" style={{ border: "1px solid var(--border)" }} onClick={() => anexoInputRef.current?.click()}>Adicionar arquivo</button>
                  </div>
                  {anexos.map((a, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 13, padding: "6px 10px", borderRadius: 6, background: "var(--bg2)", border: "1px solid var(--border)", marginBottom: 6 }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <span className="badge badge-neutral" style={{ marginRight: 8 }}>{CATEGORIAS_ANEXO.find((c) => c.valor === a.categoria)?.label}</span>
                        {a.file.name}
                      </span>
                      <button onClick={() => setAnexos((p) => p.filter((_, idx) => idx !== i))} style={{ border: "none", background: "transparent", color: "var(--danger)", cursor: "pointer", fontSize: 16 }}>×</button>
                    </div>
                  ))}
                </details>

                {/* Ações */}
                <div style={{ display: "flex", gap: 8, justifyContent: "space-between", flexWrap: "wrap", position: "sticky", bottom: 0, background: "var(--bg)", padding: "12px 76px 12px 0", borderTop: "1px solid var(--border)", zIndex: 2 }}>
                  {/* padding à direita: o botão flutuante do assistente fica no canto e cobria o Salvar */}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn" style={{ border: "1px solid var(--border)", color: "var(--danger)" }} onClick={descartarAtual} disabled={salvando}>Descartar</button>
                    <button className="btn" style={{ border: "1px solid var(--border)" }} onClick={pular} disabled={salvando} title="Deixa esta para depois (o que você já conferiu fica guardado)">Pular</button>
                  </div>
                  <button className="btn btn-primary" style={{ fontSize: 15, padding: "10px 22px" }} onClick={salvar} disabled={salvando}>
                    {salvando ? "Salvando…" : proximaPronta(atual.pasta) ? "Salvar e próxima →" : "Salvar"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
