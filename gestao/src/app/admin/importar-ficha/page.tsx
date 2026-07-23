"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DB, usuarioAtual } from "@/lib/db";
import { Paciente, Procedimento } from "@/lib/types";
import Topbar from "@/components/Topbar";
import Odontograma from "@/components/Odontograma";
import { useToast } from "@/components/Toast";

// ── Fluxo "Importar ficha por foto" ─────────────────────────────
// 1 foto (ou as 2 páginas) → IA de visão lê anamnese + procedimentos →
// você revisa tudo numa tela → 1 clique cria paciente + anamnese +
// procedimentos + conta quitada (com flag de NF) + anexa raio-x/exames.

// Perguntas de saúde NA ORDEM EXATA da ficha de papel da LCR (facilita a conferência).
// Bloco geral — uma por linha, como no papel.
const SAUDE_GERAL: { key: string; label: string; desc?: string }[] = [
  { key: "tratamento_medico", label: "Está em tratamento médico atualmente?" },
  { key: "gravidez", label: "Gravidez" },
  { key: "medicacao", label: "Está fazendo uso de alguma medicação?", desc: "medicacao_desc" },
  { key: "alergia", label: "Tem alergia?", desc: "alergia_desc" },
  { key: "operado", label: "Já foi operado?", desc: "operado_desc" },
  { key: "prob_cicatrizacao", label: "Teve problemas com a cicatrização?" },
  { key: "alergia_anestesia", label: "Teve problemas com a anestesia?" },
  { key: "prob_hemorragia", label: "Teve problemas de hemorragia?" },
];
// "Sofre de alguma das seguintes doenças?" — pares na mesma disposição do papel.
const SAUDE_DOENCAS: { key: string; label: string }[] = [
  { key: "febre_reumatica", label: "Febre Reumática" },
  { key: "prob_cardiacos", label: "Problemas cardíacos" },
  { key: "prob_renais", label: "Problemas renais" },
  { key: "prob_gastricos", label: "Problemas gástricos" },
  { key: "prob_respiratorios", label: "Problemas respiratórios" },
  { key: "prob_alergicos", label: "Problemas alérgicos" },
  { key: "prob_articulares", label: "Problemas articulares ou reumatismo" },
  { key: "diabetes", label: "Diabetes" },
  { key: "hipertensao", label: "Hipertensão arterial" },
];
const SAUDE_TODOS = [...SAUDE_GERAL, ...SAUDE_DOENCAS];

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
  valor: number;
  nfEmitida: boolean;
  formaPagto: string;
};
type AnexoPendente = { file: File; categoria: CatAnexo };

const brl = (v: number) =>
  "R$ " + (v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// dd/mm/aaaa (ou variações) → yyyy-mm-dd
const paraISO = (s?: string | null): string => {
  if (!s) return "";
  const t = String(s).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/(\d{1,2})\D(\d{1,2})\D(\d{2,4})/);
  if (!m) return "";
  let [, d, mo, y] = m;
  if (y.length === 2) y = (Number(y) > 40 ? "19" : "20") + y;
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

export default function ImportarFichaPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [fase, setFase] = useState<"upload" | "revisao" | "sucesso">("upload");
  const [salvo, setSalvo] = useState<{ pacienteId: number; nome: string; procs: number; anexos: number } | null>(null);
  const [autor, setAutor] = useState("");
  const [clinicaId, setClinicaId] = useState<number | null>(null);

  // Upload
  const [fotos, setFotos] = useState<File[]>([]);
  const [lendo, setLendo] = useState(false);
  const fotoInputRef = useRef<HTMLInputElement | null>(null);

  // Revisão — paciente
  const [nome, setNome] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [sexo, setSexo] = useState("F");
  const [cpf, setCpf] = useState("");
  const [rg, setRg] = useState("");
  const [tel, setTel] = useState("");
  const [endereco, setEndereco] = useState("");
  const [profissao, setProfissao] = useState("");
  const [indicadoPor, setIndicadoPor] = useState("");

  // Revisão — anamnese
  const [saude, setSaude] = useState<Record<string, string>>({});
  const [queixa, setQueixa] = useState("");
  const [habitos, setHabitos] = useState("");
  const [antecedentes, setAntecedentes] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [autorizaFotos, setAutorizaFotos] = useState(false);
  const [dataFicha, setDataFicha] = useState("");

  // Revisão — procedimentos + anexos
  const [procs, setProcs] = useState<ProcRev[]>([]);
  const [anexos, setAnexos] = useState<AnexoPendente[]>([]);
  const [catAnexo, setCatAnexo] = useState<CatAnexo>("raio-x");
  const anexoInputRef = useRef<HTMLInputElement | null>(null);

  // Campos com baixa confiança na leitura (destaque amarelo)
  const [revisar, setRevisar] = useState<Set<string>>(new Set());
  const [salvando, setSalvando] = useState(false);
  // Passo da revisão: 1=anamnese · 2=odontograma/dentes · 3=procedimentos/valores
  const [passo, setPasso] = useState<1 | 2 | 3>(1);

  useEffect(() => {
    (async () => {
      const u = await usuarioAtual();
      if (u?.nome) setAutor(u.nome);
      const c = await DB.clinica.get();
      setClinicaId(c?.id ?? null);
    })();
  }, []);

  const rev = (k: string): React.CSSProperties =>
    revisar.has(k) ? { borderColor: "#F59E0B", background: "#FFFBEB" } : {};

  // ── Upload de fotos ───────────────────────────────────────
  const onPickFotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const arr = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/"));
    if (arr.length) setFotos((p) => [...p, ...arr].slice(0, 8));
    e.target.value = "";
  };
  const removerFoto = (i: number) => setFotos((p) => p.filter((_, idx) => idx !== i));

  const lerFicha = async () => {
    if (!fotos.length) {
      showToast("Adicione ao menos uma foto da ficha.", "error");
      return;
    }
    setLendo(true);
    try {
      const fd = new FormData();
      fotos.forEach((f) => fd.append("imagens", f));
      const res = await fetch("/api/ai/importar-ficha", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Falha ao ler a ficha.");
      aplicarResultado(json.dados ?? {}, json.procedimentos ?? [], json.revisar ?? []);
      setPasso(1);
      setFase("revisao");
      const n = (json.revisar ?? []).length;
      showToast(
        n > 0 ? `Ficha lida. Confira os ${n} campo(s) destacados antes de salvar.` : "Ficha lida. Revise antes de salvar.",
        "success",
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível ler a ficha.", "error");
    } finally {
      setLendo(false);
    }
  };

  const aplicarResultado = (d: Record<string, any>, procsIA: any[], flags: string[]) => {
    setNome(d.nome ? String(d.nome) : "");
    setNascimento(paraISO(d.nascimento));
    setSexo(String(d.sexo || "").toUpperCase().startsWith("M") ? "M" : "F");
    setCpf(d.cpf ? String(d.cpf) : "");
    setRg(d.identidade ? String(d.identidade) : "");
    setTel(d.tel ? String(d.tel) : "");
    setEndereco([d.endereco, d.numero].filter(Boolean).join(", "));
    setProfissao(d.profissao ? String(d.profissao) : "");
    setIndicadoPor(d.indicado_por ? String(d.indicado_por) : "");

    const s: Record<string, string> = {};
    SAUDE_TODOS.forEach(({ key, desc }: { key: string; label: string; desc?: string }) => {
      s[key] = normSimNao(d[key]) || "não";
      if (desc) s[desc] = d[desc] ? String(d[desc]) : "";
    });
    setSaude(s);
    setQueixa(d.queixa ? String(d.queixa) : "");
    setHabitos(d.habitos ? String(d.habitos) : "");
    setAntecedentes(d.antecedentes_familiares ? String(d.antecedentes_familiares) : "");
    setObservacoes(d.observacoes ? String(d.observacoes) : "");
    setAutorizaFotos(normSimNao(d.autoriza_fotos) === "sim");
    setDataFicha(paraISO(d.local_data) || "");

    const lista: ProcRev[] = (procsIA ?? []).map((p: any) => ({
      data: paraISO(p?.data),
      descricao: p?.descricao ? String(p.descricao) : "",
      dente: p?.dente != null ? String(p.dente) : "",
      valor: typeof p?.valorPago === "number" ? p.valorPago : Number(p?.valorPago) || 0,
      nfEmitida: false,
      formaPagto: "",
    }));
    setProcs(lista);
    setRevisar(new Set(flags));
    setAnexos([]);
  };

  // ── Procedimentos ─────────────────────────────────────────
  const setProc = (i: number, patch: Partial<ProcRev>) =>
    setProcs((p) => p.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const addProc = () =>
    setProcs((p) => [...p, { data: dataFicha || "", descricao: "", dente: "", valor: 0, nfEmitida: false, formaPagto: "" }]);
  const removerProc = (i: number) => setProcs((p) => p.filter((_, idx) => idx !== i));

  const totalPago = useMemo(() => procs.reduce((s, p) => s + (p.valor || 0), 0), [procs]);

  // Odontograma (só visualização): monta Procedimento[] a partir das linhas com dente.
  const procsParaOdonto: Procedimento[] = useMemo(
    () =>
      procs
        .filter((p) => p.dente.trim() !== "")
        .map((p, i) => ({
          id: i,
          pacienteId: 0,
          dente: p.dente,
          procedimento: p.descricao || "Procedimento",
          custo: p.valor,
          status: "Concluído",
        })),
    [procs],
  );

  // ── Anexos ────────────────────────────────────────────────
  const onPickAnexos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const arr = Array.from(e.target.files ?? []);
    if (arr.length) setAnexos((p) => [...p, ...arr.map((file) => ({ file, categoria: catAnexo }))]);
    e.target.value = "";
  };
  const removerAnexo = (i: number) => setAnexos((p) => p.filter((_, idx) => idx !== i));

  // ── Salvar tudo ───────────────────────────────────────────
  const salvarTudo = async () => {
    if (!nome.trim()) {
      showToast("Informe o nome do paciente.", "error");
      return;
    }
    setSalvando(true);
    try {
      // 1) Paciente
      const [end, num] = endereco.split(",").map((x) => x.trim());
      const pac = await DB.pacientes.save({
        nome: nome.trim(),
        nascimento: nascimento || undefined,
        cpf: cpf || undefined,
        sexo,
        rg: rg || undefined,
        tel: tel || "",
        endereco: end || undefined,
        numero: num || undefined,
        plano: "Particular",
        status: "Ativo",
      } as Paciente);
      const pacienteId = pac.id as number;

      // 2) Anamnese (respostas no mesmo formato da ficha digital)
      const respostas: Record<string, any> = {
        ...saude,
        queixa,
        profissao,
        identidade: rg,
        indicado_por: indicadoPor,
        habitos,
        antecedentes_familiares: antecedentes,
        observacoes,
        autorizacaoFoto: autorizaFotos,
        _origem: "importacao-foto",
        ...(autor ? { _autor: autor } : {}),
      };
      await DB.anamneses.save({
        pacienteId,
        respostas,
        pacienteNome: nome.trim(),
        data: dataFicha || new Date().toISOString().split("T")[0],
        status: "Assinado",
      });

      // 3) Procedimentos + 4) conta quitada (com flag NF) por procedimento pago
      for (const p of procs) {
        if (!p.descricao.trim() && !p.valor) continue;
        await DB.procedimentos.save({
          pacienteId,
          dente: p.dente || "",
          procedimento: p.descricao.trim() || "Procedimento",
          custo: p.valor || 0,
          status: "Concluído",
          obs: p.data ? `Executado em ${new Date(p.data + "T00:00:00").toLocaleDateString("pt-BR")}` : undefined,
        } as Procedimento);

        if (p.valor > 0) {
          await DB.contas.criar(
            {
              pacienteId,
              descricao: p.descricao.trim() || "Procedimento",
              valorTotal: p.valor,
              status: "quitada",
              nfEmitida: p.nfEmitida,
            },
            [
              {
                numero: 1,
                valor: p.valor,
                pago: true,
                pagoEm: p.data || dataFicha || undefined,
                formaPagamento: p.formaPagto || undefined,
              },
            ],
          );
        }
      }

      // 5) Anexos (raio-x / exames)
      let anexosOk = 0;
      if (anexos.length && clinicaId) {
        for (const a of anexos) {
          try {
            await DB.anexos.upload(pacienteId, clinicaId, a.file, a.categoria, autor);
            anexosOk++;
          } catch {
            showToast(`Falha ao anexar "${a.file.name}".`, "error");
          }
        }
      }

      const procsSalvos = procs.filter((p) => p.descricao.trim() || p.valor).length;
      setSalvo({ pacienteId, nome: nome.trim(), procs: procsSalvos, anexos: anexosOk });
      setFase("sucesso");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível salvar a ficha.", "error");
    } finally {
      setSalvando(false);
    }
  };

  const resetar = () => {
    setFotos([]);
    setNome(""); setNascimento(""); setSexo("F"); setCpf(""); setRg(""); setTel("");
    setEndereco(""); setProfissao(""); setIndicadoPor("");
    setSaude({}); setQueixa(""); setHabitos(""); setAntecedentes(""); setObservacoes("");
    setAutorizaFotos(false); setDataFicha("");
    setProcs([]); setAnexos([]); setRevisar(new Set());
    setPasso(1);
    setFase("upload");
  };

  // ── UI ────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "9px 11px", borderRadius: 8,
    border: "1px solid var(--border)", background: "var(--bg)", fontSize: 14,
  };
  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4, display: "block" };

  // Uma pergunta de saúde (label + Sim/Não + descrição quando "sim").
  const renderCampoSaude = (key: string, label: string, desc?: string) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 13, ...(revisar.has(key) ? { color: "#B45309", fontWeight: 600 } : {}) }}>{label}</span>
        <select
          value={saude[key] ?? "não"}
          onChange={(e) => setSaude((st) => ({ ...st, [key]: e.target.value }))}
          style={{
            padding: "4px 8px", borderRadius: 6, fontSize: 13, fontWeight: 600, flexShrink: 0,
            border: "1px solid var(--border)",
            background: saude[key] === "sim" ? "#FEF2F2" : "var(--bg)",
            color: saude[key] === "sim" ? "var(--danger)" : "var(--text)",
            ...rev(key),
          }}
        >
          <option value="não">Não</option>
          <option value="sim">Sim</option>
        </select>
      </div>
      {desc && saude[key] === "sim" && (
        <input
          placeholder="Qual(is)?"
          value={saude[desc] ?? ""}
          onChange={(e) => setSaude((st) => ({ ...st, [desc]: e.target.value }))}
          style={{ ...inputStyle, padding: "6px 9px", fontSize: 13, ...rev(desc) }}
        />
      )}
    </div>
  );

  return (
    <>
      <Topbar title="Importar ficha por foto" />
      <main className="page-content">
        <div style={{ maxWidth: 900, margin: "0 auto" }}>

          {fase === "upload" && (
            <div className="card" style={{ padding: 24 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Fotografe a ficha do paciente</h2>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 18 }}>
                Envie as fotos da ficha — a <strong>página 1 (anamnese)</strong> e a <strong>página 2 (odontograma / procedimentos)</strong>.
                A IA lê tudo e você revisa antes de salvar. Nada é salvo sem sua conferência.
              </p>

              <input ref={fotoInputRef} type="file" accept="image/*" multiple hidden onChange={onPickFotos} />
              <div
                onClick={() => fotoInputRef.current?.click()}
                style={{
                  border: "2px dashed var(--border)", borderRadius: 12, padding: "34px 20px",
                  textAlign: "center", cursor: "pointer", background: "var(--bg2)", marginBottom: 16,
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 6 }}>📷</div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Toque para adicionar fotos</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>Até 8 imagens · JPG/PNG</div>
              </div>

              {fotos.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 18 }}>
                  {fotos.map((f, i) => (
                    <div key={i} style={{ position: "relative" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={URL.createObjectURL(f)} alt={`Foto ${i + 1}`}
                        style={{ width: 92, height: 92, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }}
                      />
                      <button
                        onClick={() => removerFoto(i)}
                        style={{
                          position: "absolute", top: -8, right: -8, width: 22, height: 22, borderRadius: "50%",
                          border: "none", background: "var(--danger)", color: "#fff", cursor: "pointer", fontSize: 13, lineHeight: 1,
                        }}
                        title="Remover"
                      >×</button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <button className="btn btn-primary" onClick={lerFicha} disabled={lendo || !fotos.length}>
                  {lendo ? "Lendo ficha…" : "Ler ficha com IA"}
                </button>
                <Link href="/admin/pacientes" className="btn" style={{ border: "1px solid var(--border)" }}>Voltar</Link>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  As imagens são enviadas com segurança e não substituem a conferência da dentista.
                </span>
              </div>
            </div>
          )}

          {fase === "sucesso" && salvo && (
            <div className="card" style={{ padding: 32, textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Ficha importada!</h2>
              <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 20 }}>
                <strong>{salvo.nome}</strong> foi criado com {salvo.procs} procedimento(s)
                {salvo.anexos ? ` e ${salvo.anexos} anexo(s)` : ""}.
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                <button className="btn btn-primary" onClick={() => { setSalvo(null); resetar(); }}>
                  Próxima ficha
                </button>
                <button className="btn" style={{ border: "1px solid var(--border)" }} onClick={() => router.push(`/admin/prontuario?id=${salvo.pacienteId}`)}>
                  Abrir prontuário
                </button>
              </div>
            </div>
          )}

          {fase === "revisao" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Stepper */}
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {[
                  { n: 1, label: "Anamnese" },
                  { n: 2, label: "Odontograma" },
                  { n: 3, label: "Procedimentos" },
                ].map((s, idx) => (
                  <React.Fragment key={s.n}>
                    {idx > 0 && <div style={{ flex: "0 0 16px", height: 1, background: "var(--border)" }} />}
                    <button
                      onClick={() => setPasso(s.n as 1 | 2 | 3)}
                      style={{
                        display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 999,
                        border: `1px solid ${passo === s.n ? "var(--primary)" : "var(--border)"}`,
                        background: passo === s.n ? "var(--primary-light)" : "transparent",
                        color: passo === s.n ? "var(--primary-darker)" : "var(--text-muted)",
                        cursor: "pointer", fontSize: 13, fontWeight: 600,
                      }}
                    >
                      <span style={{
                        width: 20, height: 20, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 11,
                        background: passo >= s.n ? "var(--primary)" : "var(--border)", color: "#fff",
                      }}>{s.n}</span>
                      {s.label}
                    </button>
                  </React.Fragment>
                ))}
              </div>

              {revisar.size > 0 && (
                <div className="card" style={{ padding: "12px 16px", borderLeft: "3px solid #F59E0B", background: "#FFFBEB", fontSize: 13 }}>
                  <strong>{revisar.size} campo(s)</strong> com baixa confiança na leitura — confira os destacados em amarelo.
                </div>
              )}

              {/* ── PASSO 1: Paciente + Anamnese ── */}
              {passo === 1 && (<>
              {/* Paciente */}
              <section className="card" style={{ padding: 20 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Paciente</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={labelStyle}>Nome *</label>
                    <input style={{ ...inputStyle, ...rev("nome") }} value={nome} onChange={(e) => setNome(e.target.value)} />
                  </div>
                  <div><label style={labelStyle}>Nascimento</label>
                    <input type="date" style={{ ...inputStyle, ...rev("nascimento") }} value={nascimento} onChange={(e) => setNascimento(e.target.value)} /></div>
                  <div><label style={labelStyle}>Sexo</label>
                    <select style={inputStyle} value={sexo} onChange={(e) => setSexo(e.target.value)}>
                      <option value="F">Feminino</option><option value="M">Masculino</option>
                    </select></div>
                  <div><label style={labelStyle}>CPF</label>
                    <input style={{ ...inputStyle, ...rev("cpf") }} value={cpf} onChange={(e) => setCpf(e.target.value)} /></div>
                  <div><label style={labelStyle}>RG / Identidade</label>
                    <input style={{ ...inputStyle, ...rev("identidade") }} value={rg} onChange={(e) => setRg(e.target.value)} /></div>
                  <div><label style={labelStyle}>Telefone</label>
                    <input style={{ ...inputStyle, ...rev("tel") }} value={tel} onChange={(e) => setTel(e.target.value)} /></div>
                  <div><label style={labelStyle}>Profissão</label>
                    <input style={{ ...inputStyle, ...rev("profissao") }} value={profissao} onChange={(e) => setProfissao(e.target.value)} /></div>
                  <div style={{ gridColumn: "1 / -1" }}><label style={labelStyle}>Endereço</label>
                    <input style={{ ...inputStyle, ...rev("endereco") }} value={endereco} onChange={(e) => setEndereco(e.target.value)} /></div>
                  <div><label style={labelStyle}>Indicado por</label>
                    <input style={inputStyle} value={indicadoPor} onChange={(e) => setIndicadoPor(e.target.value)} /></div>
                </div>
              </section>

              {/* Anamnese */}
              <section className="card" style={{ padding: 20 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Anamnese — questionário de saúde</h3>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>Na mesma ordem da ficha impressa — confira de cima pra baixo.</p>

                {/* Bloco geral (uma por linha, como no papel) */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 560 }}>
                  {SAUDE_GERAL.map(({ key, label, desc }) => (
                    <React.Fragment key={key}>{renderCampoSaude(key, label, desc)}</React.Fragment>
                  ))}
                </div>

                {/* Doenças (dois por linha, no mesmo pareamento do papel) */}
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 18, marginBottom: 10 }}>Sofre de alguma das seguintes doenças?</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px 24px", maxWidth: 620 }}>
                  {SAUDE_DOENCAS.map(({ key, label }) => (
                    <React.Fragment key={key}>{renderCampoSaude(key, label)}</React.Fragment>
                  ))}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 18 }}>
                  <div style={{ gridColumn: "1 / -1" }}><label style={labelStyle}>Queixa principal</label>
                    <input style={{ ...inputStyle, ...rev("queixa") }} value={queixa} onChange={(e) => setQueixa(e.target.value)} /></div>
                  <div><label style={labelStyle}>Hábitos</label>
                    <input style={inputStyle} value={habitos} onChange={(e) => setHabitos(e.target.value)} /></div>
                  <div><label style={labelStyle}>Antecedentes familiares</label>
                    <input style={inputStyle} value={antecedentes} onChange={(e) => setAntecedentes(e.target.value)} /></div>
                  <div style={{ gridColumn: "1 / -1" }}><label style={labelStyle}>Observações</label>
                    <input style={inputStyle} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} /></div>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, fontSize: 13, cursor: "pointer" }}>
                  <input type="checkbox" checked={autorizaFotos} onChange={(e) => setAutorizaFotos(e.target.checked)} />
                  Autoriza uso de fotos
                </label>
              </section>
              </>)}

              {/* ── PASSO 2: Odontograma / dentes ── */}
              {passo === 2 && (
              <section className="card" style={{ padding: 20 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Odontograma — dentes tratados</h3>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>
                  O odontograma é preenchido a partir do nº do dente de cada procedimento. Confira e corrija os dentes abaixo.
                </p>

                {procsParaOdonto.length > 0 ? (
                  <div style={{ pointerEvents: "none", marginBottom: 18 }}>
                    <Odontograma procedimentos={procsParaOdonto} selectedTeeth={new Set()} onSelectTeeth={() => {}} onDenteClick={() => {}} />
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "10px 0 18px" }}>
                    Nenhum dente identificado ainda — informe o dente de cada procedimento abaixo.
                  </div>
                )}

                {procs.length === 0 ? (
                  <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Nenhum procedimento lido na ficha.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 2 }}>Dente de cada procedimento</div>
                    {procs.map((p, i) => (
                      <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg2)" }}>
                        <span style={{ flex: 1, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {p.descricao || <em style={{ color: "var(--text-muted)" }}>Procedimento {i + 1}</em>}
                        </span>
                        <input
                          placeholder="Dente" title="Nº do dente (FDI). Vários? separe por vírgula"
                          value={p.dente}
                          onChange={(e) => setProc(i, { dente: e.target.value })}
                          style={{ ...inputStyle, width: 100, textAlign: "center", ...rev(`procedimentos[${i}].dente`) }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </section>
              )}

              {/* ── PASSO 3: Procedimentos + valores + anexos ── */}
              {passo === 3 && (<>
              {/* Procedimentos */}
              <section className="card" style={{ padding: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 8 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700 }}>Procedimentos, datas e valores</h3>
                  <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Total pago: <strong style={{ color: "var(--success)" }}>{brl(totalPago)}</strong></span>
                </div>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
                  Cada linha vira um procedimento concluído + um recebimento (conta quitada). Marque NF se houve nota fiscal.
                </p>

                {procs.length === 0 && (
                  <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "10px 0" }}>Nenhum procedimento lido. Você pode adicionar manualmente.</div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {procs.map((p, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "130px 1fr 70px 110px 70px 32px", gap: 8, alignItems: "center", padding: 10, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg2)" }}>
                      <input type="date" title="Data" value={p.data} onChange={(e) => setProc(i, { data: e.target.value })} style={{ ...inputStyle, ...rev(`procedimentos[${i}].data`) }} />
                      <input placeholder="Procedimento executado" value={p.descricao} onChange={(e) => setProc(i, { descricao: e.target.value })} style={{ ...inputStyle, ...rev(`procedimentos[${i}].descricao`) }} />
                      <input placeholder="Dente" title="Dente (FDI)" value={p.dente} onChange={(e) => setProc(i, { dente: e.target.value })} style={{ ...inputStyle, textAlign: "center", ...rev(`procedimentos[${i}].dente`) }} />
                      <input type="number" step="0.01" placeholder="Valor pago" value={p.valor || ""} onChange={(e) => setProc(i, { valor: Number(e.target.value) || 0 })} style={{ ...inputStyle, ...rev(`procedimentos[${i}].valorPago`) }} />
                      <label style={{ display: "flex", flexDirection: "column", alignItems: "center", fontSize: 10, color: "var(--text-muted)", gap: 2, cursor: "pointer" }} title="Nota fiscal emitida?">
                        NF
                        <input type="checkbox" checked={p.nfEmitida} onChange={(e) => setProc(i, { nfEmitida: e.target.checked })} />
                      </label>
                      <button onClick={() => removerProc(i)} title="Remover" style={{ border: "none", background: "transparent", color: "var(--danger)", cursor: "pointer", fontSize: 18 }}>×</button>
                    </div>
                  ))}
                </div>
                <button onClick={addProc} className="btn btn-sm" style={{ marginTop: 12, border: "1px dashed var(--border)" }}>+ Adicionar procedimento</button>
              </section>

              {/* Anexos */}
              <section className="card" style={{ padding: 20 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Anexos (raio-x, exames)</h3>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>Opcional. Serão salvos no prontuário do paciente após confirmar.</p>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
                  <select value={catAnexo} onChange={(e) => setCatAnexo(e.target.value as CatAnexo)} style={{ ...inputStyle, width: "auto" }}>
                    {CATEGORIAS_ANEXO.map((c) => <option key={c.valor} value={c.valor}>{c.label}</option>)}
                  </select>
                  <input ref={anexoInputRef} type="file" multiple hidden onChange={onPickAnexos} />
                  <button className="btn btn-sm" style={{ border: "1px solid var(--border)" }} onClick={() => anexoInputRef.current?.click()}>Adicionar arquivo</button>
                  {!clinicaId && <span style={{ fontSize: 12, color: "var(--danger)" }}>Backend não conectado — anexos indisponíveis.</span>}
                </div>
                {anexos.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {anexos.map((a, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 13, padding: "6px 10px", borderRadius: 6, background: "var(--bg2)", border: "1px solid var(--border)" }}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          <span className="badge badge-neutral" style={{ marginRight: 8 }}>{CATEGORIAS_ANEXO.find((c) => c.valor === a.categoria)?.label}</span>
                          {a.file.name}
                        </span>
                        <button onClick={() => removerAnexo(i)} style={{ border: "none", background: "transparent", color: "var(--danger)", cursor: "pointer", fontSize: 16 }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
              </>)}

              {/* Navegação do wizard */}
              <div style={{ display: "flex", gap: 10, justifyContent: "space-between", flexWrap: "wrap", position: "sticky", bottom: 0, background: "var(--bg)", padding: "12px 0", borderTop: "1px solid var(--border)" }}>
                <button
                  className="btn"
                  style={{ border: "1px solid var(--border)" }}
                  onClick={() => (passo === 1 ? resetar() : setPasso((p) => (p - 1) as 1 | 2 | 3))}
                  disabled={salvando}
                >
                  {passo === 1 ? "Cancelar" : "Voltar"}
                </button>
                {passo < 3 ? (
                  <button className="btn btn-primary" onClick={() => setPasso((p) => (p + 1) as 1 | 2 | 3)}>
                    {passo === 1 ? "Confirmar anamnese →" : "Confirmar dentes →"}
                  </button>
                ) : (
                  <button className="btn btn-primary" onClick={salvarTudo} disabled={salvando}>
                    {salvando ? "Salvando…" : "Confirmar e salvar tudo"}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
