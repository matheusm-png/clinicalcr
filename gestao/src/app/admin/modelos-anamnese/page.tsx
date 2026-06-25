"use client";

import { useEffect, useState } from "react";
import { DB } from "@/lib/db";
import { ModeloAnamnese, SecaoModelo, TipoPergunta } from "@/lib/types";
import Topbar from "@/components/Topbar";
import EmptyState from "@/components/EmptyState";
import { useToast } from "@/components/Toast";

const TIPOS: { v: TipoPergunta; label: string }[] = [
  { v: "texto", label: "Texto" },
  { v: "sim_nao", label: "Sim / Não" },
  { v: "numero", label: "Número" },
];

const secaoVazia = (): SecaoModelo => ({ nome: "", perguntas: [{ texto: "", tipo: "texto" }] });

export default function ModelosAnamnesePage() {
  const { showToast, confirm } = useToast();
  const [modelos, setModelos] = useState<ModeloAnamnese[]>([]);
  const [editando, setEditando] = useState(false);
  const [id, setId] = useState<number | null>(null);
  const [nome, setNome] = useState("");
  const [secoes, setSecoes] = useState<SecaoModelo[]>([secaoVazia()]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { load(); }, []);
  const load = async () => setModelos(await DB.modelosAnamnese.list());

  const novo = () => {
    setId(null); setNome(""); setSecoes([secaoVazia()]); setEditando(true);
  };
  const editar = (m: ModeloAnamnese) => {
    setId(m.id!); setNome(m.nome);
    setSecoes(m.estrutura.length ? structuredClone(m.estrutura) : [secaoVazia()]);
    setEditando(true);
  };
  const cancelar = () => setEditando(false);

  // Edição da estrutura
  const addSecao = () => setSecoes((s) => [...s, secaoVazia()]);
  const removeSecao = (si: number) => setSecoes((s) => s.filter((_, i) => i !== si));
  const setSecaoNome = (si: number, v: string) => setSecoes((s) => s.map((sec, i) => i === si ? { ...sec, nome: v } : sec));
  const addPergunta = (si: number) => setSecoes((s) => s.map((sec, i) => i === si ? { ...sec, perguntas: [...sec.perguntas, { texto: "", tipo: "texto" }] } : sec));
  const removePergunta = (si: number, pi: number) => setSecoes((s) => s.map((sec, i) => i === si ? { ...sec, perguntas: sec.perguntas.filter((_, j) => j !== pi) } : sec));
  const setPergunta = (si: number, pi: number, campo: "texto" | "tipo", v: string) =>
    setSecoes((s) => s.map((sec, i) => i === si ? {
      ...sec, perguntas: sec.perguntas.map((p, j) => j === pi ? { ...p, [campo]: v } : p),
    } : sec));

  const salvar = async () => {
    if (!nome.trim()) return showToast("Dê um nome ao modelo.", "error");
    const estrutura = secoes
      .map((sec) => ({ nome: sec.nome.trim(), perguntas: sec.perguntas.filter((p) => p.texto.trim()).map((p) => ({ texto: p.texto.trim(), tipo: p.tipo })) }))
      .filter((sec) => sec.perguntas.length > 0);
    if (estrutura.length === 0) return showToast("Adicione ao menos uma pergunta.", "error");
    setSalvando(true);
    try {
      await DB.modelosAnamnese.save({ ...(id ? { id } : {}), nome: nome.trim(), estrutura, ativo: true });
      setEditando(false);
      await load();
      showToast("Modelo salvo.", "success");
    } catch {
      showToast("Não foi possível salvar o modelo.", "error");
    } finally {
      setSalvando(false);
    }
  };

  const remover = async (m: ModeloAnamnese) => {
    if (m.id == null) return;
    if (!(await confirm(`Remover o modelo "${m.nome}"?`, { danger: true, okLabel: "Remover" }))) return;
    try {
      await DB.modelosAnamnese.remove(m.id);
      await load();
      showToast("Modelo removido.", "success");
    } catch {
      showToast("Não foi possível remover.", "error");
    }
  };

  return (
    <>
      <Topbar title="Modelos de anamnese">
        {!editando && <button className="btn btn-primary" onClick={novo}>+ Novo modelo</button>}
      </Topbar>
      <main className="page-content">
        {!editando ? (
          <div className="card">
            <div className="card-header">
              <span className="card-title">Modelos de anamnese</span>
            </div>
            <p style={{ padding: "0 16px", fontSize: 13, color: "var(--text-muted)", margin: "0 0 12px" }}>
              Crie fichas de anamnese próprias (seções e perguntas). Elas ficam disponíveis no prontuário, ao lado da ficha padrão. A ficha padrão e o preenchimento por foto (OCR) continuam funcionando normalmente.
            </p>
            {modelos.length === 0 ? (
              <EmptyState title="Nenhum modelo criado" hint="Crie um modelo de anamnese personalizado para a sua clínica." action={<button className="btn btn-primary btn-sm" onClick={novo}>+ Novo modelo</button>} />
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead><tr><th>Modelo</th><th>Seções</th><th>Perguntas</th><th>Ações</th></tr></thead>
                  <tbody>
                    {modelos.map((m) => (
                      <tr key={m.id}>
                        <td><strong>{m.nome}</strong></td>
                        <td style={{ color: "var(--text-muted)" }}>{m.estrutura.length}</td>
                        <td style={{ color: "var(--text-muted)" }}>{m.estrutura.reduce((n, s) => n + s.perguntas.length, 0)}</td>
                        <td>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button className="btn btn-outline btn-sm" onClick={() => editar(m)}>Editar</button>
                            <button className="btn btn-outline btn-sm" style={{ color: "var(--danger)", borderColor: "rgba(239,68,68,0.2)" }} onClick={() => remover(m)}>Remover</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="card" style={{ padding: 20, maxWidth: 760 }}>
            <div className="form-group">
              <label className="form-label">Nome do modelo *</label>
              <input className="form-control" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Anamnese ortodontia" />
            </div>

            {secoes.map((sec, si) => (
              <div key={si} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginBottom: 12 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 10 }}>
                  <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                    <label className="form-label">Seção {si + 1}</label>
                    <input className="form-control" value={sec.nome} onChange={(e) => setSecaoNome(si, e.target.value)} placeholder="Ex.: Saúde geral" />
                  </div>
                  {secoes.length > 1 && (
                    <button className="btn btn-outline btn-sm" style={{ color: "var(--danger)", borderColor: "rgba(239,68,68,0.2)" }} onClick={() => removeSecao(si)}>Remover seção</button>
                  )}
                </div>
                {sec.perguntas.map((p, pi) => (
                  <div key={pi} style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 8 }}>
                    <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: 11 }}>Pergunta {pi + 1}</label>
                      <input className="form-control" value={p.texto} onChange={(e) => setPergunta(si, pi, "texto", e.target.value)} placeholder="Ex.: Faz uso de anticoagulante?" />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: 11 }}>Resposta</label>
                      <select className="form-control" style={{ width: 130 }} value={p.tipo} onChange={(e) => setPergunta(si, pi, "tipo", e.target.value)}>
                        {TIPOS.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
                      </select>
                    </div>
                    {sec.perguntas.length > 1 && (
                      <button className="btn btn-outline btn-sm" onClick={() => removePergunta(si, pi)} title="Remover pergunta">×</button>
                    )}
                  </div>
                ))}
                <button className="btn btn-outline btn-sm" style={{ marginTop: 4 }} onClick={() => addPergunta(si)}>+ Nova pergunta</button>
              </div>
            ))}

            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <button className="btn btn-outline btn-sm" onClick={addSecao}>+ Nova seção</button>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn btn-outline" onClick={cancelar}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar modelo"}</button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
