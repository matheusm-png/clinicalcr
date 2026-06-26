"use client";

import { useState } from "react";

const hoje = () => new Date().toISOString().split("T")[0];

export default function AgendarPage() {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [procedimento, setProcedimento] = useState("");
  const [dataPreferida, setDataPreferida] = useState("");
  const [periodo, setPeriodo] = useState("qualquer");
  const [obs, setObs] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    if (!nome.trim() || telefone.replace(/\D/g, "").length < 8) {
      setErro("Informe seu nome e um telefone válido.");
      return;
    }
    setEnviando(true);
    try {
      const res = await fetch("/api/agendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, telefone, email, procedimento, dataPreferida, periodo, obs }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível enviar.");
      setOk(true);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível enviar.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20, background: "var(--bg)" }}>
      <div style={{ width: "100%", maxWidth: 480 }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <img src="/assets/logo-lcr.svg" alt="Clínica LCR" style={{ width: 96, margin: "0 auto 8px", display: "block" }} />
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: "var(--text)" }}>Agende sua consulta</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "4px 0 0" }}>Clínica LCR · preencha e entraremos em contato para confirmar.</p>
        </div>

        <div className="card" style={{ padding: 22 }}>
          {ok ? (
            <div style={{ textAlign: "center", padding: "16px 8px" }}>
              <div style={{ fontSize: 40 }} aria-hidden>✅</div>
              <h2 style={{ fontSize: 17, fontWeight: 700, margin: "8px 0 6px" }}>Solicitação enviada!</h2>
              <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0 }}>
                Recebemos seu pedido de horário. Em breve a equipe da Clínica LCR entra em contato pelo telefone informado para confirmar.
              </p>
              <button className="btn btn-outline" style={{ marginTop: 18 }} onClick={() => { setOk(false); setNome(""); setTelefone(""); setEmail(""); setProcedimento(""); setDataPreferida(""); setPeriodo("qualquer"); setObs(""); }}>
                Enviar outra solicitação
              </button>
            </div>
          ) : (
            <form onSubmit={enviar}>
              <div className="form-group">
                <label className="form-label">Nome completo *</label>
                <input className="form-control" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" />
              </div>
              <div className="form-group">
                <label className="form-label">Telefone / WhatsApp *</label>
                <input className="form-control" type="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(00) 00000-0000" />
              </div>
              <div className="form-group">
                <label className="form-label">E-mail (opcional)</label>
                <input className="form-control" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" />
              </div>
              <div className="form-group">
                <label className="form-label">Motivo / procedimento (opcional)</label>
                <input className="form-control" value={procedimento} onChange={(e) => setProcedimento(e.target.value)} placeholder="Ex.: Avaliação, limpeza, dor de dente…" />
              </div>
              <div className="form-row form-row-2">
                <div className="form-group">
                  <label className="form-label">Data preferida</label>
                  <input className="form-control" type="date" min={hoje()} value={dataPreferida} onChange={(e) => setDataPreferida(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Período</label>
                  <select className="form-control" value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
                    <option value="qualquer">Qualquer</option>
                    <option value="manha">Manhã</option>
                    <option value="tarde">Tarde</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Observações (opcional)</label>
                <textarea className="form-control" rows={2} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Algo que devemos saber?" />
              </div>

              {erro && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 10 }}>{erro}</div>}

              <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={enviando}>
                {enviando ? "Enviando…" : "Solicitar horário"}
              </button>
            </form>
          )}
        </div>
        <p style={{ textAlign: "center", fontSize: 11, color: "var(--text-muted)", marginTop: 14 }}>
          Este é um pedido de agendamento. O horário só é confirmado após contato da clínica.
        </p>
      </div>
    </div>
  );
}
