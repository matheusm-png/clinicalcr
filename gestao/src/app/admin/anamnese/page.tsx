"use client";

import React, { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { DB } from "@/lib/db";
import { Paciente, Anamnese } from "@/lib/types";
import Topbar from "@/components/Topbar";
import { useToast } from "@/components/Toast";
import EmptyState from "@/components/EmptyState";
import AnaliseRiscoIA from "@/components/AnaliseRiscoIA";

// Rótulos amigáveis dos campos da ficha (para o aviso de revisão).
const ROTULOS_CAMPO: Record<string, string> = {
  nome: "Nome", nascimento: "Nascimento", sexo: "Sexo", tel: "Telefone", endereco: "Endereço", numero: "Número",
  indicado_por: "Indicado por", profissao: "Profissão", cpf: "CPF", identidade: "Identidade/RG", queixa: "Queixa principal",
  febre_reumatica: "Febre reumática", prob_cardiacos: "Problemas cardíacos", prob_cardiacos_desc: "Descrição (cardíaco)",
  prob_renais: "Problemas renais", prob_gastricos: "Problemas gástricos", prob_respiratorios: "Problemas respiratórios",
  prob_articulares: "Problemas articulares", diabetes: "Diabetes", hipertensao: "Hipertensão", gravidez: "Gravidez",
  fuma: "Fuma", fuma_desc: "Descrição (fumo)", tratamento_medico: "Tratamento médico", medicacao: "Medicação",
  medicacao_desc: "Descrição (medicação)", alergia: "Alergia", alergia_desc: "Descrição (alergia)", operado: "Já foi operado",
  operado_desc: "Descrição (cirurgia)", prob_cicatrizacao: "Problemas de cicatrização", alergia_anestesia: "Alergia a anestésico",
  alergia_anestesia_desc: "Descrição (anestésico)", prob_hemorragia: "Problemas de hemorragia",
  antecedentes_familiares: "Antecedentes familiares", ultima_vez_dentista: "Última ida ao dentista",
  higiene_oral: "Higiene oral", habitos: "Hábitos", observacoes: "Observações", autoriza_fotos: "Autoriza fotos",
  local_data: "Local e data",
};

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
  const { showToast } = useToast();

  // State for list view
  const [anamneseList, setAnamneseList] = useState<any[]>([]);
  const [patients, setPatients] = useState<Paciente[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [isSelectPatientModalOpen, setIsSelectPatientModalOpen] = useState(false);
  const [selectedPatientIdForNew, setSelectedPatientIdForNew] = useState("");

  // State for wizard view
  const [currentStep, setCurrentStep] = useState(1);
  const [paciente, setPaciente] = useState<Paciente | null>(null);

  // Wizard Form State
  const [nome, setNome] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [tel, setTel] = useState("");
  const [sexo, setSexo] = useState("F");
  const [cpf, setCpf] = useState("");
  const [endereco, setEndereco] = useState("");
  const [queixa, setQueixa] = useState("");

  // Step 2 Questionario Saúde State
  const [saudeRespostas, setSaudeRespostas] = useState<Record<string, any>>({
    febre_reumatica: "não",
    prob_cardiacos: "não",
    prob_cardiacos_desc: "",
    prob_renais: "não",
    prob_renais_desc: "",
    prob_gastricos: "não",
    prob_gastricos_desc: "",
    prob_respiratorios: "não",
    prob_respiratorios_desc: "",
    diabetes: "não",
    hipertensao: "não",
    fuma: "não",
    fuma_desc: "",
    tratamento_medico: "não",
    tratamento_medico_desc: "",
  });

  // Step 3 Habits/Dental State
  const [dentalRespostas, setDentalRespostas] = useState<Record<string, any>>({
    sangramento_gengiva: "não",
    ranger_dentes: "não",
    sensibilidade_frio_calor: "não",
    alergia_anestesia: "não",
    alergia_anestesia_desc: "",
  });

  // Step 4 Verification & Sign
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
    const pessoais = new Set(["nome", "nascimento", "sexo", "tel", "endereco", "cpf", "queixa", "numero", "autoriza_fotos"]);
    if (dados.nome) setNome(String(dados.nome));
    if (dados.nascimento) setNascimento(normData(dados.nascimento));
    if (dados.tel) setTel(String(dados.tel));
    if (dados.sexo) setSexo(normSexo(String(dados.sexo)));
    if (dados.cpf) setCpf(String(dados.cpf));
    const end = [dados.endereco, dados.numero].filter(Boolean).join(", ");
    if (end) setEndereco(end);
    if (dados.queixa) setQueixa(String(dados.queixa));
    if (dados.autoriza_fotos != null) setCheckFoto(dados.autoriza_fotos === "sim" || dados.autoriza_fotos === true);

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
  }, [patientId]);

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
        setCurrentStep(1);
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

    let assinaturaImagem = "";
    if (canvasRef.current) {
      assinaturaImagem = canvasRef.current.toDataURL("image/png");
    }

    const answers = {
      ...saudeRespostas,
      ...dentalRespostas,
      autorizacaoFoto: checkFoto,
    };

    const payload: Anamnese = {
      pacienteId: paciente?.id as number,
      respostas: answers,
      pacienteNome: nome,
      data: new Date().toISOString().split("T")[0],
      assinatura: assinaturaImagem,
      status: "Assinado",
    };

    try {
      await DB.anamneses.save(payload);
      showToast("Anamnese finalizada com sucesso!", "success");
      router.push(paciente ? `/admin/prontuario?id=${paciente.id}` : "/admin/anamnese");
    } catch {
      showToast("Não foi possível salvar a anamnese. Tente novamente.", "error");
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
  if (!patientId) {
    const filteredAnamneses = anamneseList.filter((a) => {
      const matchesSearch = !searchTerm || a.pacienteNome.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = !statusFilter || a.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    return (
      <>
        <Topbar title="Anamnese">
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
                      <tr key={a.id}>
                        <td>
                          <strong>{a.pacienteNome}</strong>
                        </td>
                        <td>{a.data ? new Date(a.data).toLocaleDateString("pt-BR") : "—"}</td>
                        <td>Anamnese Padrão</td>
                        <td>
                          <span className="badge badge-success">{a.status}</span>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
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
            <div className="patient-avatar">{iniciais(nome)}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{nome}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Anamnese Odontológica Padrão</div>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "right" }}>
              <div>Dra. Lara Camila</div>
              <div>CRO-BA 15247</div>
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
                  {[...camposRevisar].map((k) => ROTULOS_CAMPO[k] || k).join(" · ")}
                </span>
              </span>
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
                  <label className="form-label">Data de Nascimento *</label>
                  <input
                    type="date"
                    className="form-control"
                    value={nascimento}
                    onChange={(e) => setNascimento(e.target.value)}
                    style={revStyle("nascimento")}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Telefone *</label>
                  <input
                    type="tel"
                    className="form-control"
                    value={tel}
                    onChange={(e) => setTel(e.target.value)}
                    placeholder="(00) 00000-0000"
                    style={revStyle("tel")}
                  />
                </div>
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
              <div className="form-group">
                <label className="form-label">Queixa Principal / Motivo da Consulta</label>
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
              <h3 className="section-title">Questionário de Saúde Geral</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {[
                  { key: "febre_reumatica", label: "Febre reumática" },
                  { key: "prob_cardiacos", label: "Problemas cardíacos", descKey: "prob_cardiacos_desc", descPlaceholder: "Qual problema cardíaco?" },
                  { key: "prob_renais", label: "Problemas renais", descKey: "prob_renais_desc", descPlaceholder: "Qual problema renal?" },
                  { key: "prob_respiratorios", label: "Problemas respiratórios", descKey: "prob_respiratorios_desc", descPlaceholder: "Qual problema respiratório? (ex: asma)" },
                  { key: "diabetes", label: "Diabetes" },
                  { key: "hipertensao", label: "Hipertensão arterial" },
                  { key: "fuma", label: "Fuma ou já fumou?", descKey: "fuma_desc", descPlaceholder: "Quantidade por dia?" },
                ].map((q) => (
                  <div
                    key={q.key}
                    style={{
                      borderBottom: "1px solid var(--border)",
                      paddingBottom: 12,
                      ...(camposRevisar.has(q.key)
                        ? { background: "#FFFBEB", borderLeft: "3px solid #F59E0B", paddingLeft: 10, borderRadius: 6 }
                        : {}),
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span>{q.label}</span>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline"
                          style={{
                            background: saudeRespostas[q.key] === "não" ? "#F1F5F9" : "transparent",
                            borderColor: saudeRespostas[q.key] === "não" ? "#CBD5E1" : "var(--border-solid)",
                          }}
                          onClick={() => setSaudeRespostas({ ...saudeRespostas, [q.key]: "não" })}
                        >
                          Não
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline"
                          style={{
                            background: saudeRespostas[q.key] === "sim" ? "var(--primary-light)" : "transparent",
                            borderColor: saudeRespostas[q.key] === "sim" ? "var(--primary)" : "var(--border-solid)",
                          }}
                          onClick={() => setSaudeRespostas({ ...saudeRespostas, [q.key]: "sim" })}
                        >
                          Sim
                        </button>
                      </div>
                    </div>
                    {q.descKey && saudeRespostas[q.key] === "sim" && (
                      <input
                        type="text"
                        className="form-control"
                        style={{ marginTop: 8 }}
                        value={saudeRespostas[q.descKey] || ""}
                        onChange={(e) => setSaudeRespostas({ ...saudeRespostas, [q.descKey]: e.target.value })}
                        placeholder={q.descPlaceholder}
                      />
                    )}
                  </div>
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
              <h3 className="section-title">Histórico Dental & Hábitos</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {[
                  { key: "sangramento_gengiva", label: "Gengiva sangra durante a escovação?" },
                  { key: "ranger_dentes", label: "Tem o hábito de ranger ou apertar os dentes (bruxismo)?" },
                  { key: "sensibilidade_frio_calor", label: "Sente sensibilidade ao frio ou calor?" },
                  { key: "alergia_anestesia", label: "Teve alguma reação ou alergia a anestésicos odontológicos?", descKey: "alergia_anestesia_desc", descPlaceholder: "Descreva a reação..." },
                ].map((q) => (
                  <div
                    key={q.key}
                    style={{
                      borderBottom: "1px solid var(--border)",
                      paddingBottom: 12,
                      ...(camposRevisar.has(q.key)
                        ? { background: "#FFFBEB", borderLeft: "3px solid #F59E0B", paddingLeft: 10, borderRadius: 6 }
                        : {}),
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span>{q.label}</span>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline"
                          style={{
                            background: dentalRespostas[q.key] === "não" ? "#F1F5F9" : "transparent",
                            borderColor: dentalRespostas[q.key] === "não" ? "#CBD5E1" : "var(--border-solid)",
                          }}
                          onClick={() => setDentalRespostas({ ...dentalRespostas, [q.key]: "não" })}
                        >
                          Não
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline"
                          style={{
                            background: dentalRespostas[q.key] === "sim" ? "var(--primary-light)" : "transparent",
                            borderColor: dentalRespostas[q.key] === "sim" ? "var(--primary)" : "var(--border-solid)",
                          }}
                          onClick={() => setDentalRespostas({ ...dentalRespostas, [q.key]: "sim" })}
                        >
                          Sim
                        </button>
                      </div>
                    </div>
                    {q.descKey && dentalRespostas[q.key] === "sim" && (
                      <input
                        type="text"
                        className="form-control"
                        style={{ marginTop: 8 }}
                        value={dentalRespostas[q.descKey] || ""}
                        onChange={(e) => setDentalRespostas({ ...dentalRespostas, [q.descKey]: e.target.value })}
                        placeholder={q.descPlaceholder}
                      />
                    )}
                  </div>
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
