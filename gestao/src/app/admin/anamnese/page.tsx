"use client";

import React, { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { DB, usuarioAtual } from "@/lib/db";
import { Paciente, Anamnese } from "@/lib/types";
import Topbar from "@/components/Topbar";
import { useToast } from "@/components/Toast";
import EmptyState from "@/components/EmptyState";
import AnaliseRiscoIA from "@/components/AnaliseRiscoIA";
import AnamneseViewModal from "@/components/AnamneseViewModal";
import {
  FICHA_SAUDE_TODAS, FICHA_DOENCAS, FICHA_GERAL, FICHA_TEXTO_LIVRE, FICHA_COMPLEMENTAR,
  rotuloFicha, type PerguntaSaude,
} from "@/lib/fichaSaude";

const hojeISO = () => new Date().toLocaleDateString("en-CA"); // yyyy-mm-dd no fuso local

// Uma pergunta sim/não da ficha, com o campo "Qual(is)?" que aparece ao marcar Sim.
// Fica fora do componente da página de propósito: se fosse declarada dentro, o React
// remontaria o input a cada tecla e o cursor sairia do campo.
function PerguntaSimNao({
  pergunta,
  respostas,
  setRespostas,
  destacar = false,
}: {
  pergunta: PerguntaSaude;
  respostas: Record<string, any>;
  setRespostas: (r: Record<string, any>) => void;
  destacar?: boolean;
}) {
  const { key, label, desc, placeholder } = pergunta;
  const valor = respostas[key];
  return (
    <div
      style={{
        borderBottom: "1px solid var(--border)",
        paddingBottom: 12,
        ...(destacar ? { background: "#FFFBEB", borderLeft: "3px solid #F59E0B", paddingLeft: 10, borderRadius: 6 } : {}),
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <span>{label}</span>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button
            type="button"
            className="btn btn-sm btn-outline"
            style={{
              background: valor === "não" ? "#F1F5F9" : "transparent",
              borderColor: valor === "não" ? "#CBD5E1" : "var(--border-solid)",
            }}
            onClick={() => setRespostas({ ...respostas, [key]: "não" })}
          >
            Não
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline"
            style={{
              background: valor === "sim" ? "var(--primary-light)" : "transparent",
              borderColor: valor === "sim" ? "var(--primary)" : "var(--border-solid)",
            }}
            onClick={() => setRespostas({ ...respostas, [key]: "sim" })}
          >
            Sim
          </button>
        </div>
      </div>
      {desc && valor === "sim" && (
        <input
          type="text"
          className="form-control"
          style={{ marginTop: 8 }}
          value={respostas[desc] || ""}
          onChange={(e) => setRespostas({ ...respostas, [desc]: e.target.value })}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}

const iniciais = (nomeCompleto: string) => {
  if (!nomeCompleto) return "--";
  const partes = nomeCompleto.trim().split(" ");
  return partes.length >= 2
    ? (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
    : partes[0][0].toUpperCase();
};

function AnamneseContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const patientId = searchParams.get("id");
  const novoParam = searchParams.get("novo"); // modo "novo paciente": a ficha cria o paciente + a anamnese
  const anamneseIdParam = searchParams.get("anamnese"); // modo edição: corrige uma anamnese já salva
  const { showToast } = useToast();

  // State for list view
  const [anamneseList, setAnamneseList] = useState<any[]>([]);
  const [patients, setPatients] = useState<Paciente[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [isSelectPatientModalOpen, setIsSelectPatientModalOpen] = useState(false);
  const [selectedPatientIdForNew, setSelectedPatientIdForNew] = useState("");
  const [anamneseView, setAnamneseView] = useState<Anamnese | null>(null);

  // State for wizard view
  const [currentStep, setCurrentStep] = useState(1);
  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [autorAtual, setAutorAtual] = useState("");

  // Wizard Form State
  const [nome, setNome] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [tel, setTel] = useState("");
  const [sexo, setSexo] = useState("F");
  const [cpf, setCpf] = useState("");
  const [endereco, setEndereco] = useState("");
  const [queixa, setQueixa] = useState("");
  const [profissao, setProfissao] = useState("");
  const [identidade, setIdentidade] = useState("");
  const [indicadoPor, setIndicadoPor] = useState("");

  // Data em que a anamnese foi feita. Editável — fichas antigas entram com a
  // data real do papel, não com a data da digitação.
  const [dataAnamnese, setDataAnamnese] = useState(hojeISO());

  // Id da anamnese quando estamos EDITANDO uma já salva (null = nova).
  const [editAnamneseId, setEditAnamneseId] = useState<number | null>(null);

  // Step 2 — todas as perguntas de saúde do papel, na ordem do papel.
  const [saudeRespostas, setSaudeRespostas] = useState<Record<string, any>>(() => {
    const init: Record<string, any> = {};
    FICHA_SAUDE_TODAS.forEach((q) => {
      init[q.key] = "não";
      if (q.desc) init[q.desc] = "";
    });
    return init;
  });

  // Step 3 — campos de texto livre do papel (antecedentes → observações)
  // + as perguntas complementares, que não constam no impresso.
  const [dentalRespostas, setDentalRespostas] = useState<Record<string, any>>(() => {
    const init: Record<string, any> = {};
    FICHA_TEXTO_LIVRE.forEach((c) => { init[c.key] = ""; });
    FICHA_COMPLEMENTAR.forEach((q) => { init[q.key] = "não"; });
    return init;
  });

  // Step 4 Verification & Sign
  const [assinaturaAnterior, setAssinaturaAnterior] = useState(""); // assinatura já salva (modo edição)
  const [assinaturaDesenhada, setAssinaturaDesenhada] = useState(false); // assinou nesta sessão
  const [checkDeclaro, setCheckDeclaro] = useState(false);
  const [checkFoto, setCheckFoto] = useState(false);
  const [signatureSigned, setSignatureSigned] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });

  // ── OCR por foto (IA de visão) ──────────────────────────
  const [importOpen, setImportOpen] = useState(false);
  const [importImgs, setImportImgs] = useState<File[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [camposRevisar, setCamposRevisar] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Realce amarelo nos campos que a IA marcou como baixa confiança.
  const revStyle = (key: string): React.CSSProperties =>
    camposRevisar.has(key) ? { borderColor: "#F59E0B", background: "#FFFBEB" } : {};

  const normValor = (v: any) => (typeof v === "boolean" ? (v ? "sim" : "não") : String(v));
  const normSexo = (s: string) => {
    const c = s.trim().toUpperCase();
    if (c.startsWith("M")) return "M";
    if (c.startsWith("F")) return "F";
    return sexo;
  };
  const normData = (s: string) => {
    const m = String(s).match(/(\d{1,2})\D(\d{1,2})\D(\d{4})/);
    if (!m) return "";
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  };

  // Pré-preenche o formulário com o que a IA extraiu. NADA é salvo aqui — só preenche para revisão humana.
  const aplicarOCR = (dados: Record<string, any>, revisar: string[]) => {
    // Campos que têm input próprio no passo 1 — não devem cair no questionário.
    // (habitos/observacoes/antecedentes ficam no passo 3 e entram via `dental`.)
    const pessoais = new Set([
      "nome", "nascimento", "sexo", "tel", "endereco", "cpf", "queixa", "numero", "autoriza_fotos",
      "profissao", "identidade", "indicado_por", "local_data",
    ]);
    if (dados.nome) setNome(String(dados.nome));
    if (dados.nascimento) setNascimento(normData(dados.nascimento));
    if (dados.tel) setTel(String(dados.tel));
    if (dados.sexo) setSexo(normSexo(String(dados.sexo)));
    if (dados.cpf) setCpf(String(dados.cpf));
    const end = [dados.endereco, dados.numero].filter(Boolean).join(", ");
    if (end) setEndereco(end);
    if (dados.queixa) setQueixa(String(dados.queixa));
    if (dados.profissao) setProfissao(String(dados.profissao));
    if (dados.identidade) setIdentidade(String(dados.identidade));
    if (dados.indicado_por) setIndicadoPor(String(dados.indicado_por));
    if (dados.autoriza_fotos != null) setCheckFoto(dados.autoriza_fotos === "sim" || dados.autoriza_fotos === true);
    // "Local / Data" do papel: se a IA leu uma data, ela vira a data da anamnese.
    const dataDoPapel = normData(String(dados.local_data ?? ""));
    if (dataDoPapel) setDataAnamnese(dataDoPapel);

    const saude = { ...saudeRespostas };
    const dental = { ...dentalRespostas };
    Object.entries(dados).forEach(([k, v]) => {
      if (v == null) return;
      if (k in dental) dental[k] = normValor(v);
      else if (k in saude) saude[k] = normValor(v);
      else if (!pessoais.has(k)) saude[k] = normValor(v); // preserva extras nas respostas (não perde dado)
    });
    setSaudeRespostas(saude);
    setDentalRespostas(dental);
    setCamposRevisar(new Set(revisar));
    setCurrentStep(1);
  };

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/"));
    if (files.length) setImportImgs((prev) => [...prev, ...files].slice(0, 8));
    e.target.value = ""; // permite re-selecionar/re-fotografar
  };
  const removerImg = (i: number) => setImportImgs((prev) => prev.filter((_, idx) => idx !== i));

  const processarFotos = async () => {
    if (!importImgs.length) {
      showToast("Adicione ao menos uma foto da ficha.", "error");
      return;
    }
    setImportLoading(true);
    try {
      const fd = new FormData();
      importImgs.forEach((f) => fd.append("imagens", f));
      const res = await fetch("/api/ai/ocr-ficha", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Falha ao processar a ficha.");
      aplicarOCR(json.dados ?? {}, json.revisar ?? []);
      setImportOpen(false);
      setImportImgs([]);
      const qtd = (json.revisar ?? []).length;
      showToast(
        qtd > 0
          ? `Ficha lida. Confira os ${qtd} campo(s) destacados antes de salvar.`
          : "Ficha lida. Revise os dados antes de salvar.",
        "success",
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível ler a ficha.", "error");
    } finally {
      setImportLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [patientId, anamneseIdParam]);

  useEffect(() => {
    (async () => {
      const u = await usuarioAtual();
      if (u?.nome) setAutorAtual(u.nome);
    })();
  }, []);

  // Preenche o wizard com uma anamnese já salva, para correção.
  // Grava o id: o salvar vira UPDATE do mesmo registro, não um novo.
  const carregarParaEdicao = (a: Anamnese) => {
    const r = a.respostas || {};
    setEditAnamneseId(a.id ?? null);
    setDataAnamnese(a.data || (a.criadoEm ? a.criadoEm.slice(0, 10) : hojeISO()));

    if (typeof r.queixa === "string") setQueixa(r.queixa);
    if (typeof r.profissao === "string") setProfissao(r.profissao);
    if (typeof r.identidade === "string") setIdentidade(r.identidade);
    if (typeof r.indicado_por === "string") setIndicadoPor(r.indicado_por);
    setCheckFoto(r.autorizacaoFoto === true || r.autorizacaoFoto === "sim" || r.autoriza_fotos === "sim");

    setSaudeRespostas((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => { if (r[k] != null) next[k] = r[k]; });
      return next;
    });
    setDentalRespostas((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => { if (r[k] != null) next[k] = r[k]; });
      return next;
    });

    // A assinatura anterior continua valendo até o paciente assinar de novo.
    setSignatureSigned(!!a.assinatura);
    setAssinaturaAnterior(a.assinatura || "");
    setCheckDeclaro(true);
    setCurrentStep(1);
  };

  const loadData = async () => {
    const allPatients = await DB.pacientes.list();
    setPatients(allPatients);

    if (patientId) {
      const p = await DB.pacientes.get(Number(patientId));
      if (p) {
        setPaciente(p);
        setNome(p.nome);
        setNascimento(p.nascimento || "");
        setTel(p.tel);
        setCpf(p.cpf);
        setSexo(p.sexo || "F");
        setEndereco([p.endereco, p.numero].filter(Boolean).join(", "));
        setIdentidade(p.rg || "");
        setCurrentStep(1);
      }
      // Modo edição: ?anamnese=<id> carrega a anamnese já salva para corrigir.
      if (anamneseIdParam) {
        const salvas = await DB.anamneses.list(Number(patientId));
        const alvo = salvas.find((a) => String(a.id) === String(anamneseIdParam));
        if (alvo) carregarParaEdicao(alvo);
        else showToast("Anamnese não encontrada — abrindo uma nova.", "error");
      }
    } else {
      // Carregar todas as anamneses criadas
      // Unir com dados dos pacientes para exibir na tabela
      const anamneses = await DB.anamneses.list();
      const allAnamneses = anamneses.map((an: any) => {
        const pat = allPatients.find((pt) => pt.id === an.pacienteId);
        return {
          ...an,
          pacienteNome: pat ? pat.nome : an.pacienteNome || "Paciente Desconhecido",
        };
      });
      setAnamneseList(allAnamneses);
    }
  };

  // Canvas drawing handlers
  const getMousePos = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e);
    setLastPos(pos);
    setDrawing(true);
    setSignatureSigned(true);
    setAssinaturaDesenhada(true); // assinou agora — substitui a assinatura antiga
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!drawing || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    const pos = getMousePos(e);
    ctx.strokeStyle = "#142020";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    ctx.moveTo(lastPos.x, lastPos.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

    setLastPos(pos);
  };

  const stopDrawing = () => {
    setDrawing(false);
  };

  const clearSignature = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setSignatureSigned(false);
    setAssinaturaDesenhada(false);
    setAssinaturaAnterior(""); // limpou de propósito: não reaproveita a antiga
  };

  const handleNextStep = () => {
    if (currentStep === 1 && (!nome || !tel)) {
      showToast("Preencha o Nome e o Telefone.", "error");
      return;
    }
    setCurrentStep((prev) => Math.min(prev + 1, 4));
  };

  const handlePrevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSaveAnamnese = async () => {
    if (!checkDeclaro) {
      showToast("Leia e aceite a declaração de veracidade das informações.", "error");
      return;
    }
    if (!signatureSigned) {
      showToast("Assine no campo de assinatura antes de finalizar.", "error");
      return;
    }
    if (!dataAnamnese) {
      showToast("Informe a data da anamnese (passo 1).", "error");
      setCurrentStep(1);
      return;
    }
    // A ficha cria/atualiza a ficha do paciente → Nome e Telefone são obrigatórios.
    if (!nome || !tel) {
      showToast("Preencha ao menos Nome e Telefone (passo 1).", "error");
      setCurrentStep(1);
      return;
    }

    // Em edição sem nova assinatura, mantém a assinatura original.
    let assinaturaImagem = assinaturaAnterior;
    if (canvasRef.current && assinaturaDesenhada) {
      assinaturaImagem = canvasRef.current.toDataURL("image/png");
    }

    const answers = {
      ...saudeRespostas,
      ...dentalRespostas,
      ...(queixa ? { queixa } : {}),
      ...(profissao ? { profissao } : {}),
      ...(identidade ? { identidade } : {}),
      ...(indicadoPor ? { indicado_por: indicadoPor } : {}),
      autorizacaoFoto: checkFoto,
      ...(autorAtual ? { _autor: autorAtual } : {}),
    };

    try {
      // Cria (modo "novo paciente") ou atualiza a ficha do paciente a partir da anamnese.
      const base: Paciente = paciente ?? { nome: "", cpf: "", tel: "", plano: "Particular", status: "Ativo" };
      const pacPayload: Paciente = {
        ...base,
        nome,
        tel,
        nascimento: nascimento || base.nascimento,
        cpf: cpf || base.cpf,
        sexo: sexo || base.sexo,
        endereco: endereco || base.endereco,
        rg: identidade || base.rg,
      };
      const savedPac = await DB.pacientes.save(pacPayload);
      // Consultas agendadas antes do cadastro existir ficam sem vínculo — liga pelo nome.
      if (!paciente && savedPac?.id) {
        try { await DB.agendamentos.vincularPorNome(savedPac.id, nome); } catch {}
      }

      const payload: Anamnese = {
        // Com id → atualiza a mesma anamnese (correção); sem id → cria nova.
        ...(editAnamneseId ? { id: editAnamneseId } : {}),
        pacienteId: savedPac.id as number,
        respostas: answers,
        pacienteNome: nome,
        data: dataAnamnese,
        assinatura: assinaturaImagem,
        status: "Assinado",
      };
      await DB.anamneses.save(payload);
      showToast(
        editAnamneseId
          ? "Anamnese corrigida."
          : paciente
          ? "Anamnese finalizada com sucesso!"
          : "Paciente criado e anamnese finalizada!",
        "success",
      );
      router.push(`/admin/prontuario?id=${savedPac.id}`);
    } catch {
      showToast("Não foi possível salvar. Tente novamente.", "error");
    }
  };

  const handleSelectPatientForNew = () => {
    if (!selectedPatientIdForNew) {
      showToast("Selecione um paciente.", "error");
      return;
    }
    setIsSelectPatientModalOpen(false);
    router.push(`/admin/anamnese?id=${selectedPatientIdForNew}`);
  };

  // Renderizar view de Listagem de Anamneses
  if (!patientId && !novoParam) {
    const filteredAnamneses = anamneseList.filter((a) => {
      const matchesSearch = !searchTerm || a.pacienteNome.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = !statusFilter || a.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    return (
      <>
        <Topbar title="Anamnese">
          <button className="btn btn-outline" onClick={() => router.push("/admin/anamnese?novo=1")}>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            Nova ficha por foto
          </button>
          <button className="btn btn-primary" onClick={() => setIsSelectPatientModalOpen(true)}>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
              <path d="M12 5v14M5 12h14" />
            </svg>
            Nova Anamnese
          </button>
        </Topbar>

        <main className="page-content">
          {/* Filtros */}
          <div className="card mb-6">
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div className="search-bar" style={{ flex: 1, minWidth: 220 }}>
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  placeholder="Buscar por paciente…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <select
                className="form-control"
                style={{ width: "auto", fontSize: 13 }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">Todos os status</option>
                <option value="Assinado">Assinado</option>
                <option value="Pendente">Pendente assinatura</option>
                <option value="Rascunho">Rascunho</option>
              </select>
            </div>
          </div>

          {/* Banner Informativo */}
          <div
            style={{
              background: "var(--primary-light)",
              border: "1px solid var(--primary)",
              borderRadius: "var(--radius-lg)",
              padding: "16px 20px",
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <svg
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
              style={{ width: 28, height: 28, color: "var(--primary)", flexShrink: 0 }}
            >
              <path d="M12 18h.01M8 21h8a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2z" />
            </svg>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--primary-darker)" }}>
                Use o celular para facilitar!
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                Envie o link para o paciente preencher e assinar a anamnese pelo próprio dispositivo.
              </div>
            </div>
          </div>

          {/* Tabela de Anamneses */}
          <div className="card">
            <div className="table-wrapper">
              {filteredAnamneses.length === 0 ? (
                <EmptyState
                  icon={
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" style={{ width: 26, height: 26 }}>
                      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                      <rect x="9" y="3" width="6" height="4" rx="1" />
                      <path d="M9 14l2 2 4-4" />
                    </svg>
                  }
                  title={searchTerm || statusFilter ? "Nenhuma ficha encontrada" : "Nenhuma anamnese ainda"}
                  hint={searchTerm || statusFilter ? "Tente ajustar a busca ou os filtros." : "Inicie uma nova ficha de anamnese para um paciente."}
                />
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Paciente</th>
                      <th>Data</th>
                      <th>Modelo</th>
                      <th>Status</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAnamneses.map((a) => (
                      <tr key={a.id} onClick={() => setAnamneseView(a)} style={{ cursor: "pointer" }}>
                        <td>
                          <strong>{a.pacienteNome}</strong>
                        </td>
                        <td>{a.data ? new Date(a.data + (a.data.length <= 10 ? "T00:00:00" : "")).toLocaleDateString("pt-BR") : "—"}</td>
                        <td>{a.respostas?._modelo || "Anamnese Padrão"}</td>
                        <td>
                          <span className="badge badge-success">{a.status}</span>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <button className="btn btn-primary btn-sm" onClick={() => setAnamneseView(a)}>
                              Ver
                            </button>
                            <AnaliseRiscoIA respostas={a.respostas} pacienteNome={a.pacienteNome} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Modal Visualizar Anamnese */}
          {anamneseView && (
            <AnamneseViewModal
              anamnese={anamneseView}
              onClose={() => setAnamneseView(null)}
              onEditar={
                anamneseView.pacienteId && anamneseView.id
                  ? () => router.push(`/admin/anamnese?id=${anamneseView.pacienteId}&anamnese=${anamneseView.id}`)
                  : undefined
              }
            />
          )}

          {/* Modal Selecionar Paciente para Nova Anamnese */}
          {isSelectPatientModalOpen && (
            <div
              className="modal-overlay open"
              onClick={(e) => e.target === e.currentTarget && setIsSelectPatientModalOpen(false)}
            >
              <div className="modal">
                <div className="modal-header">
                  <span className="modal-title">Nova Anamnese</span>
                  <button className="modal-close" onClick={() => setIsSelectPatientModalOpen(false)}>
                    &times;
                  </button>
                </div>
                <div className="modal-body">
                  <div className="form-group">
                    <label className="form-label">Selecione o Paciente *</label>
                    <select
                      className="form-control"
                      value={selectedPatientIdForNew}
                      onChange={(e) => setSelectedPatientIdForNew(e.target.value)}
                    >
                      <option value="">Selecionar paciente...</option>
                      {patients.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-outline" onClick={() => setIsSelectPatientModalOpen(false)}>
                    Cancelar
                  </button>
                  <button className="btn btn-primary" onClick={handleSelectPatientForNew}>
                    Iniciar Preenchimento
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </>
    );
  }

  // Renderizar view de Preenchimento da Anamnese (Wizard)
  return (
    <>
      <Topbar title="Ficha de Anamnese" />

      <main className="page-content">
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          {/* Paciente Header */}
          <div className="card mb-6" style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px" }}>
            <div className="patient-avatar">{iniciais(nome || "N P")}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{nome || (novoParam ? "Novo paciente" : "")}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {novoParam && !paciente ? "A ficha vai criar o cadastro do paciente + a anamnese" : "Anamnese Odontológica Padrão"}
              </div>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "right" }}>
              <div>{autorAtual || "—"}</div>
            </div>
          </div>

          {/* Preencher por foto (IA de visão) */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            onChange={onPickFiles}
            style={{ display: "none" }}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setImportOpen(true)}
            style={{ width: "100%", marginBottom: camposRevisar.size > 0 ? 12 : 24, justifyContent: "center" }}
          >
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: 17, height: 17 }}>
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            Preencher por foto da ficha (IA)
          </button>

          {camposRevisar.size > 0 && (
            <div
              style={{
                background: "#FFFBEB",
                border: "1px solid #F59E0B",
                color: "#92400E",
                borderRadius: "var(--radius-lg)",
                padding: "12px 16px",
                marginBottom: 24,
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: 20, height: 20, flexShrink: 0 }}>
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" />
              </svg>
              <span>
                <strong>{camposRevisar.size} campo(s)</strong> com baixa confiança na leitura — confira antes de salvar
                {" "}(os que aparecem no formulário estão destacados em amarelo).
                <span style={{ display: "block", marginTop: 4, fontWeight: 600 }}>
                  {[...camposRevisar].map((k) => rotuloFicha(k)).join(" · ")}
                </span>
              </span>
            </div>
          )}

          {/* Modo edição — deixa claro que é correção, não anamnese nova */}
          {editAnamneseId && (
            <div
              style={{
                background: "var(--primary-light)",
                border: "1px solid var(--primary)",
                borderRadius: "var(--radius-lg)",
                padding: "12px 16px",
                marginBottom: 24,
                fontSize: 13,
              }}
            >
              <strong>Corrigindo a anamnese já registrada.</strong> As alterações substituem a anamnese
              atual — não é criada uma segunda. A assinatura anterior é mantida, a menos que o paciente assine de novo.
            </div>
          )}

          {/* Stepper */}
          <div
            className="stepper"
            style={{ display: "flex", justifyContent: "space-between", marginBottom: 30, position: "relative" }}
          >
            {[
              { step: 1, label: "Dados Pessoais" },
              { step: 2, label: "Saúde Geral" },
              { step: 3, label: "Histórico Dental" },
              { step: 4, label: "Assinatura" },
            ].map((s) => (
              <div
                key={s.step}
                className={`step ${currentStep === s.step ? "active" : currentStep > s.step ? "done" : ""}`}
                style={{ textAlign: "center", cursor: "pointer", flex: 1 }}
                onClick={() => currentStep > s.step && setCurrentStep(s.step)}
              >
                <div
                  className="step-circle"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    border: "2px solid var(--border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 8px",
                    fontWeight: 600,
                    background: currentStep === s.step ? "var(--primary)" : currentStep > s.step ? "var(--primary-dark)" : "white",
                    color: currentStep >= s.step ? "white" : "var(--text-muted)",
                  }}
                >
                  {s.step}
                </div>
                <div style={{ fontSize: 11, fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Wizard Panels */}
          {currentStep === 1 && (
            <div className="card">
              {/* Data da anamnese — primeiro campo de propósito: em ficha antiga
                  é a data do papel que vale, não a data da digitação. */}
              <div
                style={{
                  border: "1px solid var(--border-solid)",
                  borderRadius: "var(--radius)",
                  padding: "12px 14px",
                  marginBottom: 20,
                  background: "var(--bg2)",
                }}
              >
                <label className="form-label" style={{ marginBottom: 4 }}>Data da anamnese *</label>
                <input
                  type="date"
                  className="form-control"
                  style={{ maxWidth: 220 }}
                  value={dataAnamnese}
                  max={hojeISO()}
                  onChange={(e) => setDataAnamnese(e.target.value)}
                />
                <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginTop: 5 }}>
                  Ficha antiga: coloque a data em que a anamnese foi feita no papel.
                </span>
              </div>

              <h3 className="section-title">Dados Pessoais</h3>
              <div className="form-group">
                <label className="form-label">Nome Completo *</label>
                <input
                  type="text"
                  className="form-control"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Nome do paciente"
                  style={revStyle("nome")}
                />
              </div>
              <div className="form-row form-row-2">
                <div className="form-group">
                  <label className="form-label">Nascimento *</label>
                  <input
                    type="date"
                    className="form-control"
                    value={nascimento}
                    onChange={(e) => setNascimento(e.target.value)}
                    style={revStyle("nascimento")}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Sexo</label>
                  <select
                    className="form-control"
                    value={sexo}
                    onChange={(e) => setSexo(e.target.value)}
                    style={revStyle("sexo")}
                  >
                    <option value="F">Feminino</option>
                    <option value="M">Masculino</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Tel *</label>
                <input
                  type="tel"
                  className="form-control"
                  value={tel}
                  onChange={(e) => setTel(e.target.value)}
                  placeholder="(00) 00000-0000"
                  style={revStyle("tel")}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Endereço</label>
                <input
                  type="text"
                  className="form-control"
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                  placeholder="Endereço do paciente"
                  style={revStyle("endereco")}
                />
              </div>
              <div className="form-row form-row-2">
                <div className="form-group">
                  <label className="form-label">Profissão</label>
                  <input
                    type="text"
                    className="form-control"
                    value={profissao}
                    onChange={(e) => setProfissao(e.target.value)}
                    placeholder="Profissão do paciente"
                    style={revStyle("profissao")}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Indicado por</label>
                  <input
                    type="text"
                    className="form-control"
                    value={indicadoPor}
                    onChange={(e) => setIndicadoPor(e.target.value)}
                    placeholder="Quem indicou a clínica"
                    style={revStyle("indicado_por")}
                  />
                </div>
              </div>
              <div className="form-row form-row-2">
                <div className="form-group">
                  <label className="form-label">Identidade</label>
                  <input
                    type="text"
                    className="form-control"
                    value={identidade}
                    onChange={(e) => setIdentidade(e.target.value)}
                    placeholder="Nº do RG"
                    style={revStyle("identidade")}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">CPF</label>
                  <input
                    type="text"
                    className="form-control"
                    value={cpf}
                    onChange={(e) => setCpf(e.target.value)}
                    placeholder="000.000.000-00"
                    style={revStyle("cpf")}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Queixa principal e evolução da doença atual</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={queixa}
                  onChange={(e) => setQueixa(e.target.value)}
                  placeholder="Descreva o principal motivo da consulta..."
                  style={revStyle("queixa")}
                />
              </div>

              <div className="step-nav">
                <span className="step-counter">Passo 1 de 4</span>
                <button className="btn btn-primary" onClick={handleNextStep}>
                  Próximo
                </button>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="card">
              <h3 className="section-title">Questionário de Saúde</h3>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: -8, marginBottom: 16 }}>
                Mesma ordem e mesmas palavras da ficha impressa — confira de cima para baixo.
              </p>

              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
                Sofre de alguma das seguintes doenças?
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {FICHA_DOENCAS.map((q) => (
                  <PerguntaSimNao
                    key={q.key}
                    pergunta={q}
                    respostas={saudeRespostas}
                    setRespostas={setSaudeRespostas}
                    destacar={camposRevisar.has(q.key)}
                  />
                ))}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 22 }}>
                {FICHA_GERAL.map((q) => (
                  <PerguntaSimNao
                    key={q.key}
                    pergunta={q}
                    respostas={saudeRespostas}
                    setRespostas={setSaudeRespostas}
                    destacar={camposRevisar.has(q.key)}
                  />
                ))}
              </div>

              <div className="step-nav">
                <button className="btn btn-outline" onClick={handlePrevStep}>
                  Anterior
                </button>
                <button className="btn btn-primary" onClick={handleNextStep}>
                  Próximo
                </button>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="card">
              <h3 className="section-title">Antecedentes, Hábitos e Observações</h3>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: -8, marginBottom: 16 }}>
                Continuação da ficha impressa, na mesma sequência.
              </p>

              {/* Campos de texto livre do papel: antecedentes → observações */}
              {FICHA_TEXTO_LIVRE.map((c) =>
                c.key === "observacoes" ? (
                  <div className="form-group" key={c.key}>
                    <label className="form-label">{c.label}</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      value={dentalRespostas[c.key] || ""}
                      onChange={(e) => setDentalRespostas({ ...dentalRespostas, [c.key]: e.target.value })}
                      placeholder={c.placeholder}
                      style={revStyle(c.key)}
                    />
                  </div>
                ) : (
                  <div className="form-group" key={c.key}>
                    <label className="form-label">{c.label}</label>
                    <input
                      type="text"
                      className="form-control"
                      value={dentalRespostas[c.key] || ""}
                      onChange={(e) => setDentalRespostas({ ...dentalRespostas, [c.key]: e.target.value })}
                      placeholder={c.placeholder}
                      style={revStyle(c.key)}
                    />
                  </div>
                ),
              )}

              {/* Fora do impresso — fica no fim, separado, para não bagunçar a conferência */}
              <div style={{ marginTop: 26, paddingTop: 18, borderTop: "1px dashed var(--border-solid)" }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Complementar</div>
                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 14px" }}>
                  Perguntas que não constam na ficha de papel.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {FICHA_COMPLEMENTAR.map((q) => (
                    <PerguntaSimNao
                      key={q.key}
                      pergunta={q}
                      respostas={dentalRespostas}
                      setRespostas={setDentalRespostas}
                      destacar={camposRevisar.has(q.key)}
                    />
                  ))}
                </div>
              </div>

              <div className="step-nav">
                <button className="btn btn-outline" onClick={handlePrevStep}>
                  Anterior
                </button>
                <button className="btn btn-primary" onClick={handleNextStep}>
                  Próximo
                </button>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="card">
              <h3 className="section-title">Confirmação e Assinatura</h3>

              <div
                className="declaration-box"
                style={{
                  background: "var(--primary-light)",
                  border: "1px solid var(--primary)",
                  borderRadius: "12px",
                  padding: "16px 18px",
                  fontSize: 13,
                  color: "var(--primary-darker)",
                  lineHeight: 1.6,
                  marginBottom: 20,
                }}
              >
                Declaro que respondi ao questionário de saúde com sinceridade, não ocultando nenhuma informação sobre meu estado
                de saúde geral e histórico médico. Autorizo a realização dos exames e procedimentos odontológicos necessários.
              </div>

              <label
                className="accept-row"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: 14,
                  borderRadius: 10,
                  border: "1.5px solid var(--border-solid)",
                  cursor: "pointer",
                  marginBottom: 20,
                }}
              >
                <input type="checkbox" checked={checkDeclaro} onChange={(e) => setCheckDeclaro(e.target.checked)} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>Declaro e aceito os termos acima *</span>
              </label>

              <label
                className="accept-row"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: 14,
                  borderRadius: 10,
                  border: "1.5px solid var(--border-solid)",
                  cursor: "pointer",
                  marginBottom: 20,
                }}
              >
                <input type="checkbox" checked={checkFoto} onChange={(e) => setCheckFoto(e.target.checked)} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  Autorizo o uso de fotos/vídeos clínicos para documentação e estudos científicos.
                </span>
              </label>

              <div className="form-group" style={{ position: "relative" }}>
                <label className="form-label">Assinatura Digital *</label>
                <div style={{ position: "relative", border: "2px dashed var(--border-solid)", borderRadius: 10 }}>
                  <canvas
                    ref={canvasRef}
                    width={500}
                    height={140}
                    style={{ background: "#FAFAFA", display: "block", width: "100%", height: 140, cursor: "crosshair" }}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                  />
                  {!signatureSigned && (
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--text-muted)",
                        pointerEvents: "none",
                      }}
                    >
                      <span>Assine aqui com o mouse ou o dedo</span>
                    </div>
                  )}
                  {signatureSigned && (
                    <button
                      className="btn btn-outline btn-sm"
                      style={{ position: "absolute", top: 8, right: 8 }}
                      onClick={clearSignature}
                    >
                      Limpar
                    </button>
                  )}
                </div>
              </div>

              <div className="step-nav">
                <button className="btn btn-outline" onClick={handlePrevStep}>
                  Anterior
                </button>
                <button className="btn btn-primary" onClick={handleSaveAnamnese}>
                  Finalizar e Assinar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal: preencher por foto da ficha (IA de visão) */}
        {importOpen && (
          <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && !importLoading && setImportOpen(false)}>
            <div className="modal">
              <div className="modal-header">
                <span className="modal-title">Preencher por foto da ficha</span>
                <button className="modal-close" onClick={() => !importLoading && setImportOpen(false)}>
                  &times;
                </button>
              </div>
              <div className="modal-body">
                <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 0 }}>
                  Fotografe a ficha de anamnese preenchida à mão (uma foto por página, boa luz e enquadrada).
                  A IA preenche o formulário e você <strong>revisa antes de salvar</strong>.
                </p>

                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importLoading}
                  style={{ width: "100%", justifyContent: "center", marginBottom: 14 }}
                >
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  {importImgs.length ? "Adicionar mais fotos" : "Tirar foto / escolher"}
                </button>

                {importImgs.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                    {importImgs.map((f, i) => (
                      <div key={i} style={{ position: "relative", width: 72, height: 72, borderRadius: 8, overflow: "hidden", border: "1px solid var(--border-solid)" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={URL.createObjectURL(f)} alt={`Página ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        <button
                          type="button"
                          onClick={() => removerImg(i)}
                          disabled={importLoading}
                          aria-label="Remover foto"
                          style={{ position: "absolute", top: 2, right: 2, width: 20, height: 20, borderRadius: "50%", border: "none", background: "rgba(0,0,0,.6)", color: "#fff", cursor: "pointer", fontSize: 12, lineHeight: "20px", padding: 0 }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>
                  As imagens são enviadas com segurança para leitura por IA e não substituem a conferência da dentista.
                </p>
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline" onClick={() => setImportOpen(false)} disabled={importLoading}>
                  Cancelar
                </button>
                <button className="btn btn-primary" onClick={processarFotos} disabled={importLoading || !importImgs.length}>
                  {importLoading ? "Lendo a ficha…" : `Processar ${importImgs.length || ""} foto(s)`}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

export default function AnamnesePage() {
  return (
    <Suspense fallback={<div>Carregando ficha de anamnese...</div>}>
      <AnamneseContent />
    </Suspense>
  );
}
