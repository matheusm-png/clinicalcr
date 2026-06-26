"use client";

import { useEffect, useState } from "react";
import { DB } from "@/lib/db";
import { Orcamento, OrcamentoItem, Paciente, ProcedimentoCatalogo, Profissional } from "@/lib/types";
import Topbar from "@/components/Topbar";
import { useToast } from "@/components/Toast";
import EmptyState from "@/components/EmptyState";

const brl = (v: number) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const STATUS_BADGE: Record<string, string> = {
  rascunho: "badge-warning",
  enviado: "badge-info",
  aprovado: "badge-success",
  recusado: "badge-danger",
};
const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  aprovado: "Aprovado",
  recusado: "Recusado",
};

export default function OrcamentosPage() {
  const { showToast, confirm } = useToast();
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [catalogo, setCatalogo] = useState<ProcedimentoCatalogo[]>([]);
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);

  // Aprovação (atribui profissional aos procedimentos gerados)
  const [aprovando, setAprovando] = useState<Orcamento | null>(null);
  const [aprovarProfId, setAprovarProfId] = useState("");

  // Builder
  const [isOpen, setIsOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [pacienteId, setPacienteId] = useState("");
  const [itens, setItens] = useState<OrcamentoItem[]>([]);
  const [desconto, setDesconto] = useState("0");
  const [observacoes, setObservacoes] = useState("");
  const [salvando, setSalvando] = useState(false);

  // Explicador IA
  const [iaTexto, setIaTexto] = useState("");
  const [iaOpen, setIaOpen] = useState(false);
  const [iaLoading, setIaLoading] = useState(false);

  // Gerar cobrança a partir do orçamento aprovado
  const [cobranca, setCobranca] = useState<Orcamento | null>(null);
  const [cobParcelas, setCobParcelas] = useState("1");
  const [cobVenc, setCobVenc] = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const [orcs, pacs, cat, profs] = await Promise.all([
      DB.orcamentos.list(),
      DB.pacientes.list(),
      DB.catalogo.list(true),
      DB.profissionais.list(true),
    ]);
    setOrcamentos(orcs);
    setPacientes(pacs);
    setCatalogo(cat);
    setProfissionais(profs);
  };

  const nomePaciente = (id: number) => pacientes.find((p) => p.id === id)?.nome ?? "—";

  const subtotal = itens.reduce((s, it) => s + it.quantidade * it.valorUnitario, 0);
  const total = Math.max(0, subtotal - (parseFloat(desconto) || 0));

  const abrirNovo = () => {
    setEditId(null);
    setPacienteId("");
    setItens([]);
    setDesconto("0");
    setObservacoes("");
    setIsOpen(true);
  };

  const abrirEdit = async (id?: number) => {
    if (id == null) return;
    const orc = await DB.orcamentos.get(id);
    if (!orc) return;
    setEditId(orc.id ?? null);
    setPacienteId(String(orc.pacienteId));
    setItens(orc.itens ?? []);
    setDesconto(String(orc.desconto));
    setObservacoes(orc.observacoes ?? "");
    setIsOpen(true);
  };

  const addItemCatalogo = (catId: string) => {
    if (!catId) return;
    const c = catalogo.find((x) => String(x.id) === catId);
    if (!c) return;
    setItens((arr) => [
      ...arr,
      { catalogoId: c.id, descricao: c.nome, dente: "", quantidade: 1, valorUnitario: c.preco },
    ]);
  };

  const updateItem = (i: number, patch: Partial<OrcamentoItem>) => {
    setItens((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  };
  const removeItem = (i: number) => setItens((arr) => arr.filter((_, idx) => idx !== i));

  const salvar = async () => {
    if (!pacienteId) return showToast("Selecione o paciente.", "error");
    if (itens.length === 0) return showToast("Adicione ao menos um procedimento.", "error");
    setSalvando(true);
    try {
      const payload: Orcamento = {
        ...(editId ? { id: editId } : {}),
        pacienteId: Number(pacienteId),
        status: "rascunho",
        desconto: parseFloat(desconto) || 0,
        total,
        observacoes,
        itens,
      };
      await DB.orcamentos.salvar(payload);
      setIsOpen(false);
      await load();
      showToast(editId ? "Orçamento atualizado." : "Orçamento criado.", "success");
    } catch {
      showToast("Não foi possível salvar o orçamento.", "error");
    } finally {
      setSalvando(false);
    }
  };

  const abrirAprovar = (orc: Orcamento) => {
    if (orc.id == null) return;
    // default = único profissional ativo
    setAprovarProfId(profissionais.length === 1 ? String(profissionais[0].id) : "");
    setAprovando(orc);
  };

  const confirmarAprovar = async () => {
    if (!aprovando?.id) return;
    try {
      await DB.orcamentos.aprovar(aprovando.id, aprovarProfId ? Number(aprovarProfId) : null);
      setAprovando(null);
      await load();
      showToast("Orçamento aprovado e procedimentos lançados no prontuário.", "success");
    } catch {
      showToast("Não foi possível aprovar.", "error");
    }
  };

  const mudarStatus = async (orc: Orcamento, status: Orcamento["status"]) => {
    if (orc.id == null) return;
    try {
      await DB.orcamentos.setStatus(orc.id, status);
      await load();
      showToast("Status atualizado.", "success");
    } catch {
      showToast("Não foi possível atualizar.", "error");
    }
  };

  const remover = async (orc: Orcamento) => {
    if (orc.id == null) return;
    if (!(await confirm("Excluir este orçamento?", { danger: true, okLabel: "Excluir" }))) return;
    try {
      await DB.orcamentos.remove(orc.id);
      await load();
      showToast("Orçamento excluído.", "success");
    } catch {
      showToast("Não foi possível excluir.", "error");
    }
  };

  const gerarCobranca = async () => {
    if (!cobranca?.id) return;
    const n = Math.max(1, parseInt(cobParcelas) || 1);
    try {
      await DB.contas.gerarDoOrcamento(cobranca.id, n, cobVenc);
      setCobranca(null);
      showToast(`Cobrança gerada em ${n}x. Veja em "A Receber".`, "success");
    } catch {
      showToast("Não foi possível gerar a cobrança.", "error");
    }
  };

  const explicarIA = async (orc: Orcamento) => {
    setIaLoading(true);
    setIaOpen(true);
    setIaTexto("");
    try {
      const full = orc.id ? await DB.orcamentos.get(orc.id) : orc;
      const input = {
        paciente: nomePaciente(orc.pacienteId),
        itens: (full?.itens ?? []).map((i) => ({ procedimento: i.descricao, dente: i.dente, valor: i.valorUnitario })),
        desconto: orc.desconto,
        total: orc.total,
      };
      const r = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "explicar-orcamento", input }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
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
      <Topbar title="Orçamentos">
        <button className="btn btn-primary" onClick={abrirNovo}>
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
            <path d="M12 5v14M5 12h14" />
          </svg>
          Novo Orçamento
        </button>
      </Topbar>

      <main className="page-content">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Orçamentos</span>
            <span className="text-muted">{orcamentos.length} no total</span>
          </div>

          {orcamentos.length === 0 ? (
            <EmptyState
              title="Nenhum orçamento ainda"
              hint="Monte o plano de tratamento do paciente e gere o orçamento."
              action={<button className="btn btn-primary btn-sm" onClick={abrirNovo}>+ Novo orçamento</button>}
            />
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Paciente</th>
                    <th>Data</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {orcamentos.map((o) => (
                    <tr key={o.id}>
                      <td><strong>{nomePaciente(o.pacienteId)}</strong></td>
                      <td style={{ color: "var(--text-muted)" }}>
                        {o.criadoEm ? new Date(o.criadoEm).toLocaleDateString("pt-BR") : "—"}
                      </td>
                      <td><strong>{brl(o.total)}</strong></td>
                      <td><span className={`badge ${STATUS_BADGE[o.status]}`}>{STATUS_LABEL[o.status]}</span></td>
                      <td>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <button className="btn btn-outline btn-sm" onClick={() => explicarIA(o)}>Explicar (IA)</button>
                          <button className="btn btn-outline btn-sm" onClick={() => abrirEdit(o.id)}>Abrir</button>
                          {o.status !== "aprovado" && (
                            <button className="btn btn-primary btn-sm" onClick={() => abrirAprovar(o)}>Aprovar</button>
                          )}
                          {o.status === "aprovado" && (
                            <button className="btn btn-outline btn-sm" onClick={() => { setCobranca(o); setCobParcelas("1"); setCobVenc(new Date().toISOString().split("T")[0]); }}>
                              Gerar cobrança
                            </button>
                          )}
                          {o.status === "rascunho" && (
                            <button className="btn btn-outline btn-sm" onClick={() => mudarStatus(o, "enviado")}>Enviar</button>
                          )}
                          <button className="icon-btn danger" title="Excluir" onClick={() => remover(o)}>
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Builder */}
        {isOpen && (
          <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && setIsOpen(false)}>
            <div className="modal modal-lg">
              <div className="modal-header">
                <span className="modal-title">{editId ? "Editar Orçamento" : "Novo Orçamento"}</span>
                <button className="modal-close" onClick={() => setIsOpen(false)}>×</button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Paciente *</label>
                  <select className="form-control" value={pacienteId} onChange={(e) => setPacienteId(e.target.value)}>
                    <option value="">Selecione…</option>
                    {pacientes.map((p) => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Adicionar procedimento</label>
                  <select className="form-control" value="" onChange={(e) => { addItemCatalogo(e.target.value); e.target.value = ""; }}>
                    <option value="">+ Escolher do catálogo…</option>
                    {catalogo.map((c) => (
                      <option key={c.id} value={c.id}>{c.nome} — {brl(c.preco)}</option>
                    ))}
                  </select>
                </div>

                {/* Itens */}
                {itens.length > 0 && (
                  <div className="table-wrapper" style={{ marginBottom: 16 }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Procedimento</th>
                          <th style={{ width: 70 }}>Dente</th>
                          <th style={{ width: 60 }}>Qtd</th>
                          <th style={{ width: 110 }}>Valor un.</th>
                          <th style={{ width: 100 }}>Subtotal</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {itens.map((it, i) => (
                          <tr key={i}>
                            <td>
                              <input className="form-control" value={it.descricao} onChange={(e) => updateItem(i, { descricao: e.target.value })} />
                            </td>
                            <td>
                              <input className="form-control" value={it.dente ?? ""} onChange={(e) => updateItem(i, { dente: e.target.value })} placeholder="—" />
                            </td>
                            <td>
                              <input type="number" min={1} className="form-control" value={it.quantidade} onChange={(e) => updateItem(i, { quantidade: parseInt(e.target.value) || 1 })} />
                            </td>
                            <td>
                              <input type="number" step="0.01" className="form-control" value={it.valorUnitario} onChange={(e) => updateItem(i, { valorUnitario: parseFloat(e.target.value) || 0 })} />
                            </td>
                            <td><strong>{brl(it.quantidade * it.valorUnitario)}</strong></td>
                            <td>
                              <button className="icon-btn danger" title="Remover" onClick={() => removeItem(i)}>
                                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                  <path d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label">Desconto (R$)</label>
                    <input type="number" step="0.01" className="form-control" value={desconto} onChange={(e) => setDesconto(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Total</label>
                    <input className="form-control" value={brl(total)} readOnly style={{ fontWeight: 700 }} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Observações</label>
                  <textarea className="form-control" rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline" onClick={() => setIsOpen(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={salvar} disabled={salvando}>
                  {salvando ? "Salvando…" : "Salvar orçamento"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Gerar cobrança */}
        {aprovando && (
          <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && setAprovando(null)}>
            <div className="modal" style={{ maxWidth: 420 }}>
              <div className="modal-header">
                <span className="modal-title">Aprovar orçamento — {nomePaciente(aprovando.pacienteId)}</span>
                <button className="modal-close" onClick={() => setAprovando(null)}>×</button>
              </div>
              <div className="modal-body">
                <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 16 }}>
                  Os procedimentos serão lançados como <strong style={{ color: "var(--text)" }}>pendentes</strong> no prontuário do paciente.
                </p>
                <div className="form-group">
                  <label className="form-label">Profissional responsável</label>
                  <select className="form-control" value={aprovarProfId} onChange={(e) => setAprovarProfId(e.target.value)}>
                    <option value="">Não atribuir agora</option>
                    {profissionais.map((pr) => (
                      <option key={pr.id} value={String(pr.id)}>{pr.nome}</option>
                    ))}
                  </select>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    Atribua para que a produção entre no relatório de comissões. Pode ajustar depois no prontuário.
                  </span>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline" onClick={() => setAprovando(null)}>Cancelar</button>
                <button className="btn btn-primary" onClick={confirmarAprovar}>Aprovar</button>
              </div>
            </div>
          </div>
        )}

        {cobranca && (
          <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && setCobranca(null)}>
            <div className="modal" style={{ maxWidth: 420 }}>
              <div className="modal-header">
                <span className="modal-title">Gerar cobrança — {nomePaciente(cobranca.pacienteId)}</span>
                <button className="modal-close" onClick={() => setCobranca(null)}>×</button>
              </div>
              <div className="modal-body">
                <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 16 }}>
                  Total do orçamento: <strong style={{ color: "var(--text)" }}>{brl(cobranca.total)}</strong>
                </p>
                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label">Parcelas</label>
                    <input type="number" min={1} className="form-control" value={cobParcelas} onChange={(e) => setCobParcelas(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">1º vencimento</label>
                    <input type="date" className="form-control" value={cobVenc} onChange={(e) => setCobVenc(e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline" onClick={() => setCobranca(null)}>Cancelar</button>
                <button className="btn btn-primary" onClick={gerarCobranca}>Gerar</button>
              </div>
            </div>
          </div>
        )}

        {/* Explicador IA */}
        {iaOpen && (
          <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && setIaOpen(false)}>
            <div className="modal" style={{ maxWidth: 520 }}>
              <div className="modal-header">
                <span className="modal-title">Explicação para o paciente (IA)</span>
                <button className="modal-close" onClick={() => setIaOpen(false)}>×</button>
              </div>
              <div className="modal-body">
                {iaLoading ? (
                  <div style={{ color: "var(--text-muted)", padding: "12px 0" }}>Gerando explicação…</div>
                ) : (
                  <div style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.55 }}>{iaTexto}</div>
                )}
              </div>
              <div className="modal-footer">
                {!iaLoading && iaTexto && (
                  <button className="btn btn-outline" onClick={() => { navigator.clipboard?.writeText(iaTexto); showToast("Texto copiado.", "success"); }}>
                    Copiar
                  </button>
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
