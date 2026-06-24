"use client";

import { useEffect, useRef, useState } from "react";
import { DB } from "@/lib/db";
import { Documento, Clinica, Paciente } from "@/lib/types";
import { MODELOS, montarHtmlImpressao } from "@/lib/documentos/modelos";
import { useToast } from "@/components/Toast";
import EmptyState from "@/components/EmptyState";
import SignaturePad, { SignaturePadHandle } from "@/components/SignaturePad";

const TIPO_LABEL: Record<Documento["tipo"], string> = {
  receituario: "Receituário",
  atestado: "Atestado",
  declaracao: "Declaração",
  termo: "Termo",
  outro: "Documento",
};

export default function DocumentosTab({
  paciente,
  autor,
}: {
  paciente: Paciente;
  autor?: string;
}) {
  const { showToast, confirm } = useToast();
  const [lista, setLista] = useState<Documento[]>([]);
  const [clinica, setClinica] = useState<Clinica | null>(null);
  const [carregando, setCarregando] = useState(true);

  // Editor (criar/editar)
  const [aberto, setAberto] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [tipo, setTipo] = useState<Documento["tipo"]>("receituario");
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [assinaturaAtual, setAssinaturaAtual] = useState<string>(""); // assinatura já salva
  const [salvando, setSalvando] = useState(false);
  const padRef = useRef<SignaturePadHandle>(null);

  useEffect(() => {
    (async () => {
      const [c] = await Promise.all([DB.clinica.get()]);
      setClinica(c);
      await load();
      setCarregando(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paciente.id]);

  const load = async () => setLista(await DB.documentos.list(paciente.id!));

  const novo = () => {
    setEditId(null);
    setAssinaturaAtual("");
    const modelo = MODELOS.find((m) => m.id === "receituario")!;
    const { titulo, conteudo } = modelo.gerar({ paciente, clinica });
    setTipo("receituario");
    setTitulo(titulo);
    setConteudo(conteudo);
    setAberto(true);
  };

  const aplicarModelo = (id: Documento["tipo"]) => {
    setTipo(id);
    // Só repreenche se for criação (não sobrescreve edição de um doc salvo).
    if (editId == null) {
      const modelo = MODELOS.find((m) => m.id === id);
      if (modelo) {
        const g = modelo.gerar({ paciente, clinica });
        setTitulo(g.titulo);
        setConteudo(g.conteudo);
      }
    }
  };

  const editar = (d: Documento) => {
    setEditId(d.id!);
    setTipo(d.tipo);
    setTitulo(d.titulo);
    setConteudo(d.conteudo);
    setAssinaturaAtual(d.assinatura || "");
    setAberto(true);
  };

  const salvar = async () => {
    if (!titulo.trim() || !conteudo.trim()) {
      return showToast("Preencha o título e o conteúdo.", "error");
    }
    setSalvando(true);
    // Nova assinatura traçada agora tem prioridade; senão mantém a já salva.
    const novaAssinatura = padRef.current?.toDataURL() || assinaturaAtual || undefined;
    try {
      await DB.documentos.save({
        ...(editId ? { id: editId } : {}),
        pacienteId: paciente.id!,
        tipo,
        titulo: titulo.trim(),
        conteudo: conteudo.trim(),
        assinatura: novaAssinatura,
        autor,
      });
      setAberto(false);
      await load();
      showToast("Documento salvo.", "success");
    } catch {
      showToast("Não foi possível salvar o documento.", "error");
    } finally {
      setSalvando(false);
    }
  };

  const remover = async (d: Documento) => {
    if (d.id == null) return;
    if (!(await confirm(`Remover "${d.titulo}"?`, { danger: true, okLabel: "Remover" }))) return;
    try {
      await DB.documentos.remove(d.id);
      await load();
      showToast("Documento removido.", "success");
    } catch {
      showToast("Não foi possível remover o documento.", "error");
    }
  };

  // Abre a janela de impressão com HTML A4 autossuficiente (vira PDF no diálogo).
  const imprimir = (d: Documento) => {
    const win = window.open("", "_blank", "width=820,height=900");
    if (!win) {
      showToast("Permita pop-ups para imprimir/gerar o PDF.", "error");
      return;
    }
    win.document.write(montarHtmlImpressao(d, clinica));
    win.document.close();
    win.focus();
  };

  return (
    <div>
      {/* Ação principal */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>Documentos do paciente</span>
        <button className="btn btn-primary btn-sm" onClick={novo}>+ Novo documento</button>
      </div>

      {carregando ? (
        <div style={{ padding: 28, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Carregando…</div>
      ) : lista.length === 0 ? (
        <EmptyState
          compact
          title="Nenhum documento"
          hint="Gere receituários, atestados e declarações a partir de modelos — com assinatura e PDF."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {lista.slice().reverse().map((d) => (
            <div key={d.id} style={{ borderLeft: "3px solid var(--primary)", background: "var(--bg2)", borderRadius: 8, padding: "12px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{d.titulo}</span>
                    <span className="badge badge-info" style={{ fontSize: 10 }}>{TIPO_LABEL[d.tipo]}</span>
                    {d.assinatura ? (
                      <span className="badge badge-success" style={{ fontSize: 10 }}>Assinado</span>
                    ) : (
                      <span className="badge badge-warning" style={{ fontSize: 10 }}>Sem assinatura</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
                    {d.criadoEm ? new Date(d.criadoEm).toLocaleString("pt-BR") : ""}{d.autor ? ` · ${d.autor}` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button className="btn btn-primary btn-sm" onClick={() => imprimir(d)}>Imprimir / PDF</button>
                  <button className="btn btn-outline btn-sm" onClick={() => editar(d)}>Editar</button>
                  <button className="btn btn-outline btn-sm" style={{ color: "var(--danger)", borderColor: "rgba(239,68,68,0.2)" }} onClick={() => remover(d)}>Remover</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor */}
      {aberto && (
        <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && setAberto(false)}>
          <div className="modal" style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <span className="modal-title">{editId ? "Editar documento" : "Novo documento"}</span>
              <button className="modal-close" onClick={() => setAberto(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Modelo</label>
                <select className="form-control" value={tipo} onChange={(e) => aplicarModelo(e.target.value as Documento["tipo"])}>
                  {MODELOS.map((m) => (
                    <option key={m.id} value={m.id}>{m.nome}</option>
                  ))}
                </select>
                {editId == null && (
                  <small style={{ color: "var(--text-muted)", fontSize: 11 }}>Trocar o modelo recarrega o texto pré-preenchido.</small>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Título *</label>
                <input type="text" className="form-control" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Conteúdo *</label>
                <textarea className="form-control" rows={10} value={conteudo} onChange={(e) => setConteudo(e.target.value)} style={{ fontFamily: "inherit", lineHeight: 1.6 }} />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>Assinatura {assinaturaAtual && "(documento já assinado — assine de novo para substituir)"}</span>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => { padRef.current?.clear(); setAssinaturaAtual(""); }}>Limpar</button>
                </label>
                {assinaturaAtual && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={assinaturaAtual} alt="assinatura atual" style={{ height: 56, marginBottom: 8, border: "1px solid var(--border)", borderRadius: 6, background: "#fff", padding: 4 }} />
                )}
                <SignaturePad ref={padRef} height={140} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setAberto(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
