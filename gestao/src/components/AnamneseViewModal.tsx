"use client";

import { Anamnese } from "@/lib/types";
import AnaliseRiscoIA from "@/components/AnaliseRiscoIA";

// Rótulos amigáveis para as chaves do questionário padrão.
const LABELS: Record<string, string> = {
  febre_reumatica: "Febre reumática",
  prob_cardiacos: "Problemas cardíacos",
  prob_renais: "Problemas renais",
  prob_gastricos: "Problemas gástricos",
  prob_respiratorios: "Problemas respiratórios",
  diabetes: "Diabetes",
  hipertensao: "Hipertensão",
  fuma: "Fumante",
  tratamento_medico: "Em tratamento médico",
  sangramento_gengiva: "Sangramento na gengiva",
  ranger_dentes: "Range os dentes (bruxismo)",
  sensibilidade_frio_calor: "Sensibilidade a frio/calor",
  alergia_anestesia: "Alergia a anestesia",
  queixa: "Queixa principal",
  profissao: "Profissão",
  identidade: "Identidade (RG)",
  habitos: "Hábitos",
  observacoes: "Observações",
  autorizacaoFoto: "Autoriza uso de fotos",
  autoriza_fotos: "Autoriza uso de fotos",
  indicado_por: "Indicado por",
  local_data: "Local e data",
  medicacao: "Usa medicação",
  alergia: "Alergia",
  operado: "Já foi operado(a)",
  gravidez: "Gravidez",
  prob_alergicos: "Problemas alérgicos",
  prob_articulares: "Problemas articulares",
  prob_cicatrizacao: "Problemas de cicatrização",
  prob_hemorragia: "Problemas de hemorragia",
  antecedentes_familiares: "Antecedentes familiares",
  ultima_vez_dentista: "Última ida ao dentista",
  higiene_oral: "Higiene oral",
};

const humanizar = (k: string) =>
  LABELS[k] ?? k.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

const simNao = (v: unknown) => {
  const s = typeof v === "boolean" ? (v ? "sim" : "não") : String(v ?? "").trim().toLowerCase();
  return s === "sim" || s === "não" || s === "nao" ? (s === "sim" ? "sim" : "não") : null;
};

export default function AnamneseViewModal({
  anamnese,
  pacienteNome,
  onClose,
}: {
  anamnese: Anamnese;
  pacienteNome?: string;
  onClose: () => void;
}) {
  const r = anamnese.respostas || {};
  const nome = pacienteNome || anamnese.pacienteNome;

  // Separa: perguntas sim/não (com possível campo _desc) e respostas de texto livre.
  const yesNo: { key: string; label: string; valor: "sim" | "não"; desc?: string }[] = [];
  const textos: { key: string; label: string; valor: string }[] = [];

  Object.entries(r).forEach(([k, v]) => {
    if (k.startsWith("_") || k.endsWith("_desc")) return;
    if (v == null || v === "") return;
    const sn = simNao(v);
    if (sn) {
      const desc = typeof r[`${k}_desc`] === "string" ? String(r[`${k}_desc`]).trim() : "";
      yesNo.push({ key: k, label: humanizar(k), valor: sn, ...(desc ? { desc } : {}) });
    } else {
      textos.push({ key: k, label: humanizar(k), valor: String(v) });
    }
  });
  // "Sim" primeiro — são os pontos de atenção clínica.
  yesNo.sort((a, b) => (a.valor === b.valor ? 0 : a.valor === "sim" ? -1 : 1));

  const dataRegistro = anamnese.data || anamnese.criadoEm;

  return (
    <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <span className="modal-title">Anamnese{nome ? ` — ${nome}` : ""}</span>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          {/* Metadados */}
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 18, fontSize: 12.5, color: "var(--text-muted)" }}>
            {dataRegistro && (
              <span>📅 {new Date(dataRegistro.length <= 10 ? dataRegistro + "T00:00:00" : dataRegistro).toLocaleDateString("pt-BR")}</span>
            )}
            <span>📋 {typeof r._modelo === "string" && r._modelo ? r._modelo : "Anamnese Odontológica Padrão"}</span>
            {typeof r._autor === "string" && r._autor && <span>👤 {r._autor}</span>}
            {anamnese.status && <span className="badge badge-success">{anamnese.status}</span>}
          </div>

          {/* Questionário sim/não */}
          {yesNo.length > 0 && (
            <>
              <div className="modal-section-title">Questionário de saúde</div>
              <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden", marginBottom: 18 }}>
                {yesNo.map((q) => (
                  <div key={q.key} style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <span style={{ fontSize: 13.5 }}>{q.label}</span>
                      <span className={`badge ${q.valor === "sim" ? "badge-danger" : "badge-success"}`}>
                        {q.valor === "sim" ? "Sim" : "Não"}
                      </span>
                    </div>
                    {q.desc && (
                      <div style={{ fontSize: 12.5, color: "var(--text-muted)", background: "var(--bg2)", borderRadius: 6, padding: "6px 10px" }}>
                        {q.desc}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Respostas de texto livre */}
          {textos.length > 0 && (
            <>
              <div className="modal-section-title">Informações complementares</div>
              <div style={{ display: "grid", gap: 10, marginBottom: 18 }}>
                {textos.map((t) => (
                  <div key={t.key}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px", color: "var(--text-muted)", marginBottom: 2 }}>
                      {t.label}
                    </div>
                    <div style={{ fontSize: 13.5, whiteSpace: "pre-wrap" }}>{t.valor}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {yesNo.length === 0 && textos.length === 0 && (
            <div style={{ textAlign: "center", padding: "30px 10px", color: "var(--text-muted)", fontSize: 13.5 }}>
              Esta anamnese não tem respostas registradas.
            </div>
          )}

          {/* Assinatura */}
          {anamnese.assinatura && (
            <>
              <div className="modal-section-title">Assinatura do paciente</div>
              <div style={{ border: "1.5px dashed var(--border-solid)", borderRadius: "var(--radius)", background: "#fff", padding: 8 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={anamnese.assinatura} alt="Assinatura do paciente" style={{ maxWidth: "100%", maxHeight: 140, display: "block", margin: "0 auto" }} />
              </div>
            </>
          )}
        </div>
        <div className="modal-footer" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <AnaliseRiscoIA respostas={anamnese.respostas} pacienteNome={nome} />
          <button className="btn btn-primary" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}
