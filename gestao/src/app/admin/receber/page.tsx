"use client";

import { useEffect, useMemo, useState } from "react";
import { DB } from "@/lib/db";
import { ContaReceber, Paciente, Parcela } from "@/lib/types";
import Topbar from "@/components/Topbar";
import { useToast } from "@/components/Toast";
import EmptyState from "@/components/EmptyState";

const brl = (v: number) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const hoje = () => new Date().toISOString().split("T")[0];
const isAtrasada = (p: Parcela) => !p.pago && !!p.vencimento && p.vencimento < hoje();

const STATUS_BADGE: Record<string, string> = { aberta: "badge-info", quitada: "badge-success", cancelada: "badge-danger" };
const STATUS_LABEL: Record<string, string> = { aberta: "Aberta", quitada: "Quitada", cancelada: "Cancelada" };

export default function ReceberPage() {
  const { showToast, confirm } = useToast();
  const [contas, setContas] = useState<ContaReceber[]>([]);
  const [pacientes, setPacientes] = useState<Paciente[]>([]);

  // Modal nova cobrança
  const [novaOpen, setNovaOpen] = useState(false);
  const [pacienteId, setPacienteId] = useState("");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [numParcelas, setNumParcelas] = useState("1");
  const [primeiroVenc, setPrimeiroVenc] = useState(hoje());

  // Modal detalhe da conta (parcelas)
  const [detalhe, setDetalhe] = useState<ContaReceber | null>(null);

  // Modal cobrança IA
  const [iaOpen, setIaOpen] = useState(false);
  const [iaTexto, setIaTexto] = useState("");
  const [iaLoading, setIaLoading] = useState(false);

  // Geração de link de pagamento InfinitePay
  const [gerandoLink, setGerandoLink] = useState<number | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const [cs, ps] = await Promise.all([DB.contas.list(), DB.pacientes.list()]);
    setContas(cs);
    setPacientes(ps);
  };

  const nomePaciente = (id: number) => pacientes.find((p) => p.id === id)?.nome ?? "—";

  const todasParcelas = useMemo(() => contas.flatMap((c) => (c.status !== "cancelada" ? c.parcelas ?? [] : [])), [contas]);
  const totalAberto = todasParcelas.filter((p) => !p.pago).reduce((s, p) => s + p.valor, 0);
  const totalAtrasado = todasParcelas.filter(isAtrasada).reduce((s, p) => s + p.valor, 0);
  const totalRecebido = todasParcelas.filter((p) => p.pago).reduce((s, p) => s + p.valor, 0);

  const resumoConta = (c: ContaReceber) => {
    const ps = c.parcelas ?? [];
    const pagas = ps.filter((p) => p.pago).length;
    const prox = ps.filter((p) => !p.pago).sort((a, b) => (a.vencimento ?? "").localeCompare(b.vencimento ?? ""))[0];
    const atrasada = ps.some(isAtrasada);
    return { pagas, total: ps.length, prox, atrasada };
  };

  const abrirNova = () => {
    setPacienteId(""); setDescricao(""); setValor(""); setNumParcelas("1"); setPrimeiroVenc(hoje());
    setNovaOpen(true);
  };

  const criarCobranca = async () => {
    const total = parseFloat(valor);
    if (!pacienteId || !descricao || !total) return showToast("Preencha paciente, descrição e valor.", "error");
    const n = Math.max(1, parseInt(numParcelas) || 1);
    const base = Math.floor((total / n) * 100) / 100;
    const parcelas: Parcela[] = [];
    let acc = 0;
    for (let i = 1; i <= n; i++) {
      const v = i === n ? Math.round((total - acc) * 100) / 100 : base;
      acc += v;
      const d = new Date(primeiroVenc + "T00:00:00");
      d.setMonth(d.getMonth() + (i - 1));
      parcelas.push({ numero: i, valor: v, vencimento: d.toISOString().split("T")[0], pago: false });
    }
    try {
      await DB.contas.criar(
        { pacienteId: Number(pacienteId), descricao, valorTotal: total, status: "aberta" },
        parcelas,
      );
      setNovaOpen(false);
      await load();
      showToast("Cobrança criada.", "success");
    } catch {
      showToast("Não foi possível criar a cobrança.", "error");
    }
  };

  const marcarPaga = async (conta: ContaReceber, parcela: Parcela) => {
    if (parcela.id == null || conta.id == null) return;
    try {
      await DB.contas.marcarParcela(parcela.id, conta.id);
      await load(); // o modal de detalhe lê as parcelas direto de `contas`
      showToast("Parcela registrada como paga.", "success");
    } catch {
      showToast("Não foi possível registrar o pagamento.", "error");
    }
  };

  const telPaciente = (id: number) => (pacientes.find((p) => p.id === id)?.tel ?? "").replace(/\D/g, "");

  // Gera (ou regenera) o link de pagamento InfinitePay da parcela.
  const gerarLink = async (parcela: Parcela): Promise<string | null> => {
    if (parcela.id == null) return null;
    setGerandoLink(parcela.id);
    try {
      const res = await fetch("/api/pagamentos/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parcelaId: parcela.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao gerar link.");
      await load();
      if (!data.configurado) {
        showToast("Link de DEMONSTRAÇÃO gerado. Cadastre a InfiniteTag em Configurações para cobrar de verdade.", "info");
      } else {
        showToast("Link de pagamento gerado.", "success");
      }
      return data.url as string;
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Falha ao gerar link.", "error");
      return null;
    } finally {
      setGerandoLink(null);
    }
  };

  // Gera o link (se preciso) e abre o WhatsApp do paciente com a mensagem + link.
  const enviarLinkWhatsApp = async (conta: ContaReceber, parcela: Parcela) => {
    const url = parcela.pagtoLink || (await gerarLink(parcela));
    if (!url) return;
    const tel = telPaciente(conta.pacienteId);
    if (!tel) return showToast("Paciente sem telefone cadastrado.", "error");
    const primeiro = nomePaciente(conta.pacienteId).split(" ")[0];
    const msg = `Olá ${primeiro}! Segue o link para o pagamento da parcela ${parcela.numero} (${brl(parcela.valor)}): ${url}`;
    const fone = tel.length >= 11 ? `55${tel}` : tel;
    window.open(`https://wa.me/${fone}?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
  };

  const cancelar = async (c: ContaReceber) => {
    if (c.id == null) return;
    if (!(await confirm("Cancelar esta cobrança?", { danger: true, okLabel: "Cancelar cobrança" }))) return;
    try {
      await DB.contas.cancelar(c.id);
      await load();
      showToast("Cobrança cancelada.", "success");
    } catch {
      showToast("Não foi possível cancelar.", "error");
    }
  };

  const cobrancaIA = async (c: ContaReceber) => {
    const r = resumoConta(c);
    setIaOpen(true); setIaLoading(true); setIaTexto("");
    try {
      const resp = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: "redigir-mensagem",
          input: {
            tipo: "lembrete de pagamento (cobrança gentil)",
            contexto: {
              paciente: nomePaciente(c.pacienteId),
              descricao: c.descricao,
              parcela_vencida: r.prox ? { valor: r.prox.valor, vencimento: r.prox.vencimento } : null,
              total: c.valorTotal,
            },
          },
        }),
      });
      const j = await resp.json();
      if (!resp.ok) throw new Error(j.error);
      setIaTexto(j.result || "");
    } catch (e) {
      setIaOpen(false);
      showToast(e instanceof Error ? e.message : "Falha na IA.", "error");
    } finally {
      setIaLoading(false);
    }
  };

  return (
    <>
      <Topbar title="Contas a Receber">
        <button className="btn btn-primary" onClick={abrirNova}>
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nova Cobrança
        </button>
      </Topbar>

      <main className="page-content">
        <div className="stats-grid" style={{ marginBottom: 24 }}>
          <div className="stat-card">
            <div>
              <div className="stat-value">{brl(totalAberto)}</div>
              <div className="stat-label">Em aberto</div>
            </div>
          </div>
          <div className="stat-card">
            <div>
              <div className="stat-value" style={{ color: "var(--danger)" }}>{brl(totalAtrasado)}</div>
              <div className="stat-label">Em atraso</div>
            </div>
          </div>
          <div className="stat-card">
            <div>
              <div className="stat-value" style={{ color: "var(--success)" }}>{brl(totalRecebido)}</div>
              <div className="stat-label">Recebido</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Cobranças</span>
            <span className="text-muted">{contas.length} no total</span>
          </div>

          {contas.length === 0 ? (
            <EmptyState
              title="Nenhuma cobrança ainda"
              hint="Crie uma cobrança ou gere a partir de um orçamento aprovado."
              action={<button className="btn btn-primary btn-sm" onClick={abrirNova}>+ Nova cobrança</button>}
            />
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Paciente</th>
                    <th>Descrição</th>
                    <th>Total</th>
                    <th>Parcelas</th>
                    <th>Próx. venc.</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {contas.map((c) => {
                    const r = resumoConta(c);
                    return (
                      <tr key={c.id}>
                        <td><strong>{nomePaciente(c.pacienteId)}</strong></td>
                        <td style={{ color: "var(--text-muted)" }}>{c.descricao}</td>
                        <td><strong>{brl(c.valorTotal)}</strong></td>
                        <td>{r.pagas}/{r.total}</td>
                        <td>
                          {r.prox?.vencimento ? (
                            <span className={r.atrasada ? "badge badge-danger" : ""}>
                              {new Date(r.prox.vencimento + "T00:00:00").toLocaleDateString("pt-BR")}
                            </span>
                          ) : "—"}
                        </td>
                        <td><span className={`badge ${STATUS_BADGE[c.status]}`}>{STATUS_LABEL[c.status]}</span></td>
                        <td>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <button className="btn btn-outline btn-sm" onClick={() => setDetalhe(c)}>Parcelas</button>
                            <button className="btn btn-outline btn-sm" onClick={() => cobrancaIA(c)}>Cobrança (IA)</button>
                            {c.status !== "cancelada" && (
                              <button className="icon-btn danger" title="Cancelar" onClick={() => cancelar(c)}>
                                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                  <path d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Detalhe / parcelas */}
        {detalhe && (
          <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && setDetalhe(null)}>
            <div className="modal" style={{ maxWidth: 520 }}>
              <div className="modal-header">
                <span className="modal-title">Parcelas — {nomePaciente(detalhe.pacienteId)}</span>
                <button className="modal-close" onClick={() => setDetalhe(null)}>×</button>
              </div>
              <div className="modal-body">
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr><th>#</th><th>Valor</th><th>Vencimento</th><th>Status</th><th></th></tr>
                    </thead>
                    <tbody>
                      {(contas.find((c) => c.id === detalhe.id)?.parcelas ?? []).map((p) => (
                        <tr key={p.id}>
                          <td>{p.numero}</td>
                          <td><strong>{brl(p.valor)}</strong></td>
                          <td>{p.vencimento ? new Date(p.vencimento + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</td>
                          <td>
                            {p.pago ? (
                              <span className="badge badge-success">Pago</span>
                            ) : isAtrasada(p) ? (
                              <span className="badge badge-danger">Atrasada</span>
                            ) : (
                              <span className="badge badge-info">A vencer</span>
                            )}
                          </td>
                          <td>
                            {!p.pago && (
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                {p.pagtoLink ? (
                                  <>
                                    <button className="btn btn-outline btn-sm" title="Copiar link" onClick={() => { navigator.clipboard?.writeText(p.pagtoLink!); showToast("Link copiado.", "success"); }}>Copiar link</button>
                                    <button className="btn btn-sm" style={{ background: "#25D366", color: "#fff" }} title="Enviar no WhatsApp" onClick={() => enviarLinkWhatsApp(detalhe, p)}>WhatsApp</button>
                                  </>
                                ) : (
                                  <button className="btn btn-outline btn-sm" disabled={gerandoLink === p.id} onClick={() => gerarLink(p)}>
                                    {gerandoLink === p.id ? "Gerando…" : "Gerar link"}
                                  </button>
                                )}
                                <button className="btn btn-primary btn-sm" onClick={() => marcarPaga(detalhe, p)}>
                                  Marcar pago
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-primary" onClick={() => setDetalhe(null)}>Fechar</button>
              </div>
            </div>
          </div>
        )}

        {/* Nova cobrança */}
        {novaOpen && (
          <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && setNovaOpen(false)}>
            <div className="modal" style={{ maxWidth: 460 }}>
              <div className="modal-header">
                <span className="modal-title">Nova Cobrança</span>
                <button className="modal-close" onClick={() => setNovaOpen(false)}>×</button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Paciente *</label>
                  <select className="form-control" value={pacienteId} onChange={(e) => setPacienteId(e.target.value)}>
                    <option value="">Selecione…</option>
                    {pacientes.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Descrição *</label>
                  <input className="form-control" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Tratamento ortodôntico" />
                </div>
                <div className="form-row form-row-3">
                  <div className="form-group">
                    <label className="form-label">Valor total (R$) *</label>
                    <input type="number" step="0.01" className="form-control" value={valor} onChange={(e) => setValor(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Parcelas</label>
                    <input type="number" min={1} className="form-control" value={numParcelas} onChange={(e) => setNumParcelas(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">1º vencimento</label>
                    <input type="date" className="form-control" value={primeiroVenc} onChange={(e) => setPrimeiroVenc(e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline" onClick={() => setNovaOpen(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={criarCobranca}>Criar</button>
              </div>
            </div>
          </div>
        )}

        {/* Cobrança IA */}
        {iaOpen && (
          <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && setIaOpen(false)}>
            <div className="modal" style={{ maxWidth: 480 }}>
              <div className="modal-header">
                <span className="modal-title">Mensagem de cobrança (IA)</span>
                <button className="modal-close" onClick={() => setIaOpen(false)}>×</button>
              </div>
              <div className="modal-body">
                {iaLoading ? (
                  <div style={{ color: "var(--text-muted)" }}>Gerando mensagem…</div>
                ) : (
                  <div style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.55 }}>{iaTexto}</div>
                )}
              </div>
              <div className="modal-footer">
                {!iaLoading && iaTexto && (
                  <button className="btn btn-outline" onClick={() => { navigator.clipboard?.writeText(iaTexto); showToast("Copiado.", "success"); }}>Copiar</button>
                )}
                <button className="btn btn-primary" onClick={() => setIaOpen(false)}>Fechar</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
