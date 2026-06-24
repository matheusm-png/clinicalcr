"use client";

import { useState } from "react";
import { useToast } from "@/components/Toast";

/** Botão "Analisar riscos (IA)" para uma anamnese — chama /api/ai e mostra os alertas. */
export default function AnaliseRiscoIA({
  respostas,
  pacienteNome,
  size = "sm",
}: {
  respostas: Record<string, unknown> | undefined;
  pacienteNome?: string;
  size?: "sm" | "md";
}) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [resultado, setResultado] = useState("");

  const analisar = async () => {
    if (!respostas || Object.keys(respostas).length === 0) {
      showToast("Esta anamnese não tem respostas para analisar.", "error");
      return;
    }
    setLoading(true);
    try {
      const r = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "risco-anamnese", input: { respostas, pacienteNome } }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Falha na análise.");
      setResultado(j.result || "Sem alertas evidentes.");
      setAberto(true);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Não foi possível analisar.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className={`btn btn-outline ${size === "sm" ? "btn-sm" : ""}`}
        onClick={analisar}
        disabled={loading}
        title="Analisar riscos com IA"
      >
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
          <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7.4L12 17l-6.3 4.4L8 14 2 9.4h7.6L12 2z" />
        </svg>
        {loading ? "Analisando…" : "Analisar riscos (IA)"}
      </button>

      {aberto && (
        <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && setAberto(false)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Alertas clínicos (IA){pacienteNome ? ` — ${pacienteNome}` : ""}</span>
              <button className="modal-close" onClick={() => setAberto(false)}>×</button>
            </div>
            <div className="modal-body">
              <div
                style={{
                  whiteSpace: "pre-wrap",
                  fontSize: 14,
                  lineHeight: 1.55,
                  color: "var(--text)",
                }}
              >
                {resultado}
              </div>
              <div style={{ marginTop: 16, fontSize: 12, color: "var(--text-muted)", borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                ⚠️ Gerado por IA como apoio. Sempre confirme com a avaliação do cirurgião-dentista.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setAberto(false)}>Entendi</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
