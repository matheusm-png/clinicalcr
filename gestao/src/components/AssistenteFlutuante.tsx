"use client";

import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/Toast";

type Msg = { role: "user" | "assistant"; content: string };

const SUGESTOES = [
  "Quantos pacientes ativos eu tenho?",
  "Quanto recebi até agora?",
  "Tem algo em atraso a receber?",
  "Quais itens estão com estoque baixo?",
  "Quantos orçamentos estão aprovados?",
];

/** Evento global para abrir o assistente de qualquer lugar do app. */
export const ABRIR_ASSISTENTE_EVENT = "lcr:abrir-assistente";

export default function AssistenteFlutuante() {
  const { showToast } = useToast();
  const [aberto, setAberto] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (aberto) fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, loading, aberto]);

  // Abrir via evento global (banner/atalho da dashboard etc.)
  useEffect(() => {
    const abrir = () => setAberto(true);
    window.addEventListener(ABRIR_ASSISTENTE_EVENT, abrir);
    return () => window.removeEventListener(ABRIR_ASSISTENTE_EVENT, abrir);
  }, []);

  // Fechar com ESC + foco no input ao abrir
  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(false); };
    window.addEventListener("keydown", onKey);
    const t = setTimeout(() => inputRef.current?.focus(), 120);
    return () => { window.removeEventListener("keydown", onKey); clearTimeout(t); };
  }, [aberto]);

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
      {/* Botão flutuante */}
      <button
        onClick={() => setAberto((v) => !v)}
        aria-label={aberto ? "Fechar assistente" : "Abrir assistente IA"}
        title="Assistente IA"
        style={{
          position: "fixed",
          right: "max(20px, env(safe-area-inset-right))",
          bottom: "max(20px, env(safe-area-inset-bottom))",
          zIndex: 1200,
          width: 58,
          height: 58,
          borderRadius: "50%",
          border: "none",
          cursor: "pointer",
          background: "linear-gradient(135deg, var(--primary-darker), var(--primary))",
          color: "#fff",
          boxShadow: "0 8px 24px rgba(0,0,0,.28)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "transform .18s ease, box-shadow .18s ease",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.06)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
      >
        {aberto ? (
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2" style={{ width: 26, height: 26 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: 27, height: 27 }}>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            <path d="M9 10h.01M13 10h.01M17 10h.01" />
          </svg>
        )}
      </button>

      {/* Painel de chat */}
      {aberto && (
        <div
          role="dialog"
          aria-label="Assistente IA"
          style={{
            position: "fixed",
            right: "max(20px, env(safe-area-inset-right))",
            bottom: "calc(max(20px, env(safe-area-inset-bottom)) + 70px)",
            zIndex: 1200,
            width: "min(380px, calc(100vw - 32px))",
            height: "min(560px, calc(100vh - 120px))",
            display: "flex",
            flexDirection: "column",
            background: "var(--card, #fff)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            boxShadow: "0 16px 48px rgba(0,0,0,.32)",
            overflow: "hidden",
          }}
        >
          {/* Cabeçalho */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "linear-gradient(120deg, var(--primary-darker), var(--primary))", color: "#fff" }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(255,255,255,.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                <path d="M9 10h.01M13 10h.01M17 10h.01" />
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Assistente IA</div>
              <div style={{ fontSize: 11, opacity: 0.85 }}>Pergunte sobre a sua clínica</div>
            </div>
            {msgs.length > 0 && (
              <button
                onClick={() => setMsgs([])}
                title="Limpar conversa"
                style={{ background: "rgba(255,255,255,.15)", border: "none", color: "#fff", borderRadius: 8, padding: "5px 8px", cursor: "pointer", fontSize: 12 }}
              >
                Limpar
              </button>
            )}
            <button
              onClick={() => setAberto(false)}
              aria-label="Fechar"
              style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer", display: "flex", padding: 4 }}
            >
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Mensagens */}
          <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {msgs.length === 0 && (
              <div style={{ textAlign: "center", color: "var(--text-muted)", margin: "auto", maxWidth: 320 }}>
                <div style={{ fontWeight: 600, color: "var(--text)", marginBottom: 6, fontSize: 14 }}>Pergunte sobre a sua clínica</div>
                <div style={{ fontSize: 12.5, marginBottom: 14 }}>Pacientes, agenda, financeiro, estoque, orçamentos…</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
                  {SUGESTOES.map((s) => (
                    <button key={s} className="btn btn-outline btn-sm" style={{ fontSize: 12 }} onClick={() => enviar(s)}>{s}</button>
                  ))}
                </div>
              </div>
            )}

            {msgs.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div
                  style={{
                    maxWidth: "85%",
                    padding: "9px 12px",
                    borderRadius: 13,
                    fontSize: 13.5,
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
              <div style={{ alignSelf: "flex-start", color: "var(--text-muted)", fontSize: 13, padding: "9px 12px" }}>
                Pensando…
              </div>
            )}
            <div ref={fimRef} />
          </div>

          {/* Input */}
          <div style={{ borderTop: "1px solid var(--border)", padding: 10, display: "flex", gap: 8 }}>
            <input
              ref={inputRef}
              className="form-control"
              placeholder="Pergunte algo…"
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
      )}
    </>
  );
}
