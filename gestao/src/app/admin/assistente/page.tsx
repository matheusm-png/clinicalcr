"use client";

import { useEffect, useRef, useState } from "react";
import Topbar from "@/components/Topbar";
import { useToast } from "@/components/Toast";

type Msg = { role: "user" | "assistant"; content: string };

const SUGESTOES = [
  "Quantos pacientes ativos eu tenho?",
  "Quanto recebi até agora?",
  "Tem algo em atraso a receber?",
  "Quais itens estão com estoque baixo?",
  "Quantos orçamentos estão aprovados?",
];

export default function AssistentePage() {
  const { showToast } = useToast();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fimRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, loading]);

  const enviar = async (texto?: string) => {
    const pergunta = (texto ?? input).trim();
    if (!pergunta || loading) return;
    const novas: Msg[] = [...msgs, { role: "user", content: pergunta }];
    setMsgs(novas);
    setInput("");
    setLoading(true);
    try {
      const r = await fetch("/api/assistente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: novas }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setMsgs((m) => [...m, { role: "assistant", content: j.result || "—" }]);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Falha no assistente.", "error");
      setMsgs((m) => m.slice(0, -1)); // remove a pergunta que falhou
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Topbar title="Assistente IA" />
      <main className="page-content" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 60px)" }}>
        <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: 0 }}>
          {/* Mensagens */}
          <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
            {msgs.length === 0 && (
              <div style={{ textAlign: "center", color: "var(--text-muted)", margin: "auto", maxWidth: 440 }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--primary-light)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" style={{ width: 28, height: 28 }}>
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <div style={{ fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>Pergunte sobre a sua clínica</div>
                <div style={{ fontSize: 13, marginBottom: 16 }}>Pacientes, agenda, financeiro, estoque, orçamentos…</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                  {SUGESTOES.map((s) => (
                    <button key={s} className="btn btn-outline btn-sm" onClick={() => enviar(s)}>{s}</button>
                  ))}
                </div>
              </div>
            )}

            {msgs.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div
                  style={{
                    maxWidth: "80%",
                    padding: "10px 14px",
                    borderRadius: 14,
                    fontSize: 14,
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                    background: m.role === "user" ? "var(--primary)" : "var(--bg2)",
                    color: m.role === "user" ? "#fff" : "var(--text)",
                    border: m.role === "user" ? "none" : "1px solid var(--border)",
                  }}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ alignSelf: "flex-start", color: "var(--text-muted)", fontSize: 13, padding: "10px 14px" }}>
                Pensando…
              </div>
            )}
            <div ref={fimRef} />
          </div>

          {/* Input */}
          <div style={{ borderTop: "1px solid var(--border)", padding: 12, display: "flex", gap: 8 }}>
            <input
              className="form-control"
              placeholder="Pergunte algo sobre a clínica…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") enviar(); }}
              disabled={loading}
            />
            <button className="btn btn-primary" onClick={() => enviar()} disabled={loading || !input.trim()}>
              Enviar
            </button>
          </div>
        </div>
        <p style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", marginTop: 8 }}>
          Respostas geradas por IA com base nos seus dados. Confira informações sensíveis.
        </p>
      </main>
    </>
  );
}
