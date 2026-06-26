"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import s from "./agendar.module.css";

const WA = "5574991266602";
const ENDERECO = "R. Régio Emília, 210E — Centro, Irecê - BA";
const MAPS_EMBED =
  "https://www.google.com/maps?q=LCR%20Cl%C3%ADnica%20Odontol%C3%B3gica%2C%20Ir%C3%AAce%20-%20BA&output=embed";
const MAPS_LINK = "https://maps.app.goo.gl/RV3zCA5skEBB8r4Y6";

const SERVICOS = ["Avaliação", "Limpeza", "Implantes", "Lentes de contato", "Alinhadores", "Clareamento"];

type Slot = { hora: number; min: number; label: string };

// Próximos dias úteis (seg–sex), pois a clínica atende Segunda a Sexta.
function proximosDiasUteis(qtd: number): Date[] {
  const dias: Date[] = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  while (dias.length < qtd) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) dias.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return dias;
}
const ymd = (d: Date) => d.toLocaleDateString("en-CA"); // yyyy-mm-dd (local)
const DOW = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MON = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const ICON = {
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>,
  heart: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z" /></svg>,
  shield: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 4 5v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V5z" /><path d="m9 12 2 2 4-4" /></svg>,
  sparkle: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" /></svg>,
  pin: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" /></svg>,
  clock: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></svg>,
  phone: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" /></svg>,
  whats: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M.06 24l1.69-6.16a11.87 11.87 0 0 1-1.59-5.95A11.9 11.9 0 0 1 11.97.06 11.9 11.9 0 0 1 24 11.96a11.9 11.9 0 0 1-11.9 11.9 11.96 11.96 0 0 1-5.7-1.45L.06 24zM6.6 20.13l.36.22a9.86 9.86 0 0 0 5.03 1.38 9.88 9.88 0 0 0 9.88-9.88A9.88 9.88 0 0 0 11.98 2 9.88 9.88 0 0 0 2.1 11.9a9.82 9.82 0 0 0 1.51 5.26l.24.38-1 3.66 3.75-1.07zM17.4 14.3c-.15-.25-.55-.4-1.15-.7s-1.36-.67-1.56-.74c-.2-.08-.35-.11-.5.11s-.57.74-.7.9c-.13.15-.26.17-.48.06a6.4 6.4 0 0 1-1.9-1.17 7.1 7.1 0 0 1-1.3-1.63c-.14-.25 0-.38.1-.5.1-.11.25-.28.37-.43.12-.14.16-.25.24-.41.08-.17.04-.3-.02-.43-.06-.11-.5-1.22-.7-1.67-.18-.43-.37-.37-.5-.38h-.43c-.15 0-.4.06-.6.3-.2.24-.79.77-.79 1.88s.8 2.17.92 2.32c.11.15 1.58 2.42 3.83 3.39.54.23.95.37 1.28.48.54.17 1.03.15 1.42.09.43-.07 1.36-.56 1.55-1.1.19-.53.19-.99.14-1.08z" /></svg>,
};

export default function AgendarPage() {
  const dias = useMemo(() => proximosDiasUteis(14), []);

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [procedimento, setProcedimento] = useState("");
  const [obs, setObs] = useState("");

  const [dataSel, setDataSel] = useState<string>(() => ymd(dias[0]));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsErro, setSlotsErro] = useState(false);
  const [slotSel, setSlotSel] = useState<Slot | null>(null);

  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState(false);

  const bookRef = useRef<HTMLDivElement>(null);

  // Carrega horários livres sempre que a data muda.
  useEffect(() => {
    if (!dataSel) return;
    let ativo = true;
    setLoadingSlots(true);
    setSlotsErro(false);
    setSlotSel(null);
    fetch(`/api/agendar/disponibilidade?data=${dataSel}`)
      .then((r) => r.json())
      .then((d) => { if (ativo) setSlots(Array.isArray(d.slots) ? d.slots : []); })
      .catch(() => { if (ativo) { setSlots([]); setSlotsErro(true); } })
      .finally(() => { if (ativo) setLoadingSlots(false); });
    return () => { ativo = false; };
  }, [dataSel]);

  const irParaAgendamento = (proc?: string) => {
    if (proc) setProcedimento(proc);
    bookRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const formatarTelefone = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  };

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
        body: JSON.stringify({
          nome, telefone, email, procedimento, obs,
          dataPreferida: dataSel,
          periodo: slotSel ? (slotSel.hora < 12 ? "manha" : "tarde") : "qualquer",
          hora: slotSel?.hora, min: slotSel?.min,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível enviar.");
      setOk(true);
      window.scrollTo({ top: bookRef.current?.offsetTop ?? 0, behavior: "smooth" });
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível enviar.");
    } finally {
      setEnviando(false);
    }
  };

  const resetar = () => {
    setOk(false); setNome(""); setTelefone(""); setEmail(""); setProcedimento(""); setObs("");
    setSlotSel(null); setDataSel(ymd(dias[0]));
  };

  const waLink = (texto: string) => `https://wa.me/${WA}?text=${encodeURIComponent(texto)}`;

  return (
    <div className={s.page}>
      {/* ───── HERO ───── */}
      <header className={s.hero}>
        <div className={`${s.wrap} ${s.heroInner}`}>
          <img src="/assets/logo-lcr.svg" alt="Clínica LCR" className={s.logo} />
          <span className={s.eyebrow}>Clínica LCR · Odontologia em Irecê</span>
          <h1 className={s.h1}>Seu sorriso merece um <em>cuidado de verdade</em></h1>
          <p className={s.lead}>
            Agende sua consulta com a Dra. Lara Camila escolhendo o melhor horário para você.
            Atendimento humanizado, tecnologia e segurança em cada etapa.
          </p>
          <div className={s.heroCtas}>
            <button className={s.ctaPrimary} onClick={() => irParaAgendamento()}>Agendar minha consulta</button>
            <a className={s.ctaGhost} href={waLink("Olá! Vim pela página de agendamento e gostaria de tirar uma dúvida.")} target="_blank" rel="noopener noreferrer">
              {ICON.whats} Falar no WhatsApp
            </a>
          </div>
          <div className={s.heroBadges}>
            <span className={s.heroBadge}>{ICON.shield} CRO-BA 15247</span>
            <span className={s.heroBadge}>{ICON.pin} Centro de Irecê</span>
            <span className={s.heroBadge}>{ICON.clock} Seg a Sex, 8h–18h</span>
          </div>
        </div>
      </header>

      {/* ───── DIFERENCIAIS ───── */}
      <section className={s.section}>
        <div className={s.wrap}>
          <p className={s.kicker}>Por que a Clínica LCR</p>
          <h2 className={s.h2}>Um atendimento pensado para o seu conforto</h2>
          <div className={s.feats}>
            <div className={s.feat}>
              <div className={s.featIcon}>{ICON.heart}</div>
              <h3 className={s.featTitle}>Atendimento humanizado</h3>
              <p className={s.featText}>Uma recepção acolhedora e uma equipe que escuta você do início ao fim do tratamento.</p>
            </div>
            <div className={s.feat}>
              <div className={s.featIcon}>{ICON.shield}</div>
              <h3 className={s.featTitle}>Segurança biológica</h3>
              <p className={s.featText}>Protocolos rigorosos de biossegurança e esterilização em todos os procedimentos.</p>
            </div>
            <div className={s.feat}>
              <div className={s.featIcon}>{ICON.sparkle}</div>
              <h3 className={s.featTitle}>Implantes e estética</h3>
              <p className={s.featText}>Implantes, lentes de contato e clareamento para devolver função e beleza ao seu sorriso.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ───── DRA. LARA ───── */}
      <section className={s.sectionTight}>
        <div className={s.wrap}>
          <div className={s.doc}>
            <img src="/assets/foto-lara-camila.jpg" alt="Dra. Lara Camila" className={s.docPhoto} />
            <div>
              <p className={s.kicker} style={{ textAlign: "left" }}>Quem vai te atender</p>
              <h3 className={s.docName}>Dra. Lara Camila</h3>
              <p className={s.docRole}>Cirurgiã-Dentista · CRO-BA 15247 · Implantes e Estética</p>
              <p className={s.docBio}>
                À frente da Clínica LCR, a Dra. Lara Camila une técnica e cuidado para oferecer um
                tratamento personalizado. Cada paciente é avaliado com atenção para construir o
                plano ideal — da primeira consulta ao resultado final.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ───── SERVIÇOS ───── */}
      <section className={s.sectionTight}>
        <div className={s.wrap}>
          <p className={s.kicker}>O que você procura?</p>
          <h2 className={s.h2}>Escolha um serviço e agende em seguida</h2>
          <div className={s.chips}>
            {SERVICOS.map((sv) => (
              <button
                key={sv}
                className={`${s.chip} ${procedimento === sv ? s.chipActive : ""}`}
                onClick={() => irParaAgendamento(sv)}
              >
                {sv}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ───── AGENDAMENTO ───── */}
      <section className={s.section} ref={bookRef}>
        <div className={s.wrap}>
          <div className={s.bookWrap}>
            <div className={s.bookHead}>
              <h2 className={s.bookHeadTitle}>Agende sua consulta</h2>
              <p className={s.bookHeadSub}>Escolha o dia e o horário — confirmamos o seu agendamento em seguida.</p>
            </div>
            <div className={s.bookBody}>
              {ok ? (
                <div className={s.success}>
                  <div className={s.successIcon}>{ICON.check}</div>
                  <h3 style={{ fontSize: 19, fontWeight: 800, margin: "0 0 8px" }}>Solicitação enviada!</h3>
                  <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "0 auto", maxWidth: "42ch", lineHeight: 1.5 }}>
                    Recebemos seu pedido{slotSel ? <> para <strong>{new Date(dataSel + "T00:00:00").toLocaleDateString("pt-BR")} às {slotSel.label}</strong></> : ""}.
                    Em breve a equipe da Clínica LCR entra em contato pelo telefone informado para confirmar.
                  </p>
                  <button className="btn btn-outline" style={{ marginTop: 20 }} onClick={resetar}>
                    Enviar outra solicitação
                  </button>
                </div>
              ) : (
                <form onSubmit={enviar}>
                  {/* Passo 1 — data */}
                  <p className={s.stepLabel}><span className={s.stepNum}>1</span> Escolha o dia</p>
                  <div className={s.dateStrip}>
                    {dias.map((d) => {
                      const v = ymd(d);
                      return (
                        <button
                          type="button"
                          key={v}
                          className={`${s.dateBtn} ${dataSel === v ? s.dateBtnActive : ""}`}
                          onClick={() => setDataSel(v)}
                        >
                          <div className={s.dateDow}>{DOW[d.getDay()]}</div>
                          <div className={s.dateDay}>{d.getDate()}</div>
                          <div className={s.dateMon}>{MON[d.getMonth()]}</div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Passo 2 — horário */}
                  <p className={s.stepLabel}><span className={s.stepNum}>2</span> Escolha o horário</p>
                  {loadingSlots ? (
                    <div className={s.slotsMsg}>Carregando horários livres…</div>
                  ) : slotsErro ? (
                    <div className={s.slotsMsg}>Não foi possível carregar os horários agora. Você pode enviar a solicitação mesmo assim ou falar no WhatsApp.</div>
                  ) : slots.length === 0 ? (
                    <div className={s.slotsMsg}>
                      Nenhum horário livre neste dia. Tente outra data ou{" "}
                      <a href={waLink("Olá! Gostaria de verificar horários para agendar uma consulta.")} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary-darker)", fontWeight: 700 }}>
                        fale no WhatsApp
                      </a>.
                    </div>
                  ) : (
                    <div className={s.slots}>
                      {slots.map((sl) => (
                        <button
                          type="button"
                          key={sl.label}
                          className={`${s.slot} ${slotSel?.label === sl.label ? s.slotActive : ""}`}
                          onClick={() => setSlotSel(sl)}
                        >
                          {sl.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Passo 3 — dados */}
                  <p className={s.stepLabel}><span className={s.stepNum}>3</span> Seus dados</p>
                  <div className={s.fields}>
                    <div className="form-group">
                      <label className="form-label">Nome completo *</label>
                      <input className="form-control" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" />
                    </div>
                    <div className="form-row form-row-2">
                      <div className="form-group">
                        <label className="form-label">Telefone / WhatsApp *</label>
                        <input className="form-control" type="tel" inputMode="numeric" value={telefone} onChange={(e) => setTelefone(formatarTelefone(e.target.value))} placeholder="(00) 00000-0000" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">E-mail (opcional)</label>
                        <input className="form-control" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Motivo / procedimento (opcional)</label>
                      <input className="form-control" value={procedimento} onChange={(e) => setProcedimento(e.target.value)} placeholder="Ex.: Avaliação, limpeza, dor de dente…" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Observações (opcional)</label>
                      <textarea className="form-control" rows={2} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Algo que devemos saber?" />
                    </div>
                  </div>

                  {erro && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 10 }}>{erro}</div>}

                  <button type="submit" className="btn btn-primary" style={{ width: "100%", padding: "14px" }} disabled={enviando}>
                    {enviando ? "Enviando…" : slotSel ? `Solicitar ${slotSel.label}` : "Solicitar horário"}
                  </button>
                  <p className={s.note}>
                    Este é um pedido de agendamento. O horário só é confirmado após contato da clínica.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ───── LOCALIZAÇÃO ───── */}
      <section className={s.section}>
        <div className={s.wrap}>
          <p className={s.kicker}>Onde estamos</p>
          <h2 className={s.h2}>Fácil de chegar, no Centro de Irecê</h2>
          <div className={s.locGrid}>
            <div className={s.locCard}>
              <div className={s.locItem}>
                {ICON.pin}
                <div>
                  <p className={s.locItemTitle}>Endereço</p>
                  <p className={s.locItemText}>{ENDERECO}</p>
                  <a href={MAPS_LINK} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)", fontWeight: 600, fontSize: 14 }}>Ver no mapa →</a>
                </div>
              </div>
              <div className={s.locItem}>
                {ICON.clock}
                <div>
                  <p className={s.locItemTitle}>Horário de funcionamento</p>
                  <p className={s.locItemText}>Segunda a Sexta, das 8h às 18h</p>
                </div>
              </div>
              <div className={s.locItem}>
                {ICON.phone}
                <div>
                  <p className={s.locItemTitle}>Telefone / WhatsApp</p>
                  <p className={s.locItemText}>(74) 99126-6602</p>
                  <a href={waLink("Olá! Gostaria de agendar uma consulta na Clínica LCR.")} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)", fontWeight: 600, fontSize: 14 }}>Chamar no WhatsApp →</a>
                </div>
              </div>
            </div>
            <iframe className={s.mapFrame} src={MAPS_EMBED} loading="lazy" referrerPolicy="no-referrer-when-downgrade" title="Mapa da Clínica LCR" />
          </div>
        </div>
      </section>

      {/* ───── FOOTER ───── */}
      <footer className={s.foot}>
        <img src="/assets/logo-lcr.svg" alt="Clínica LCR" className={s.footLogo} />
        <a className={s.ctaPrimary} href={waLink("Olá! Vim pela página de agendamento da Clínica LCR.")} target="_blank" rel="noopener noreferrer" style={{ marginTop: 4 }}>
          {ICON.whats} Falar no WhatsApp
        </a>
        <p className={s.footNote}>
          Clínica LCR · {ENDERECO}. Este é um pedido de agendamento; o horário só é confirmado após contato da clínica.
        </p>
      </footer>
    </div>
  );
}
