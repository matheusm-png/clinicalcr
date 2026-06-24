"use client";

import { useEffect, useRef, useState } from "react";
import { DB } from "@/lib/db";
import { Anexo } from "@/lib/types";
import { useToast } from "@/components/Toast";
import EmptyState from "@/components/EmptyState";

type Categoria = Anexo["categoria"];

const CATEGORIAS: { valor: Categoria; label: string }[] = [
  { valor: "foto", label: "Foto" },
  { valor: "raio-x", label: "Raio-X" },
  { valor: "documento", label: "Documento" },
  { valor: "outro", label: "Outro" },
];

const MAX_MB = 15;
const isImagem = (tipo?: string) => !!tipo && tipo.startsWith("image/");

function tamanhoLegivel(bytes?: number) {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AnexosTab({ pacienteId, autor }: { pacienteId: number; autor?: string }) {
  const { showToast, confirm } = useToast();
  const [lista, setLista] = useState<Anexo[]>([]);
  const [thumbs, setThumbs] = useState<Record<number, string>>({});
  const [clinicaId, setClinicaId] = useState<number | null>(null);
  const [carregando, setCarregando] = useState(true);

  const [categoria, setCategoria] = useState<Categoria>("foto");
  const [filtro, setFiltro] = useState<Categoria | "todos">("todos");
  const [enviando, setEnviando] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const [preview, setPreview] = useState<{ anexo: Anexo; url: string } | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    (async () => {
      const clinica = await DB.clinica.get();
      setClinicaId(clinica?.id ?? null);
      await load();
      setCarregando(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteId]);

  const load = async () => {
    const itens = await DB.anexos.list(pacienteId);
    setLista(itens);
    // Gera miniaturas (URLs assinadas) só para imagens.
    const novos: Record<number, string> = {};
    await Promise.all(
      itens
        .filter((a) => a.id != null && isImagem(a.tipo))
        .map(async (a) => {
          const url = await DB.anexos.signedUrl(a.path);
          if (url) novos[a.id!] = url;
        }),
    );
    setThumbs(novos);
  };

  const enviarArquivos = async (files: FileList | File[]) => {
    if (!clinicaId) {
      showToast("Clínica não identificada — anexos exigem o backend conectado.", "error");
      return;
    }
    const arr = Array.from(files);
    if (!arr.length) return;
    setEnviando(true);
    let ok = 0;
    for (const file of arr) {
      if (file.size > MAX_MB * 1024 * 1024) {
        showToast(`"${file.name}" excede ${MAX_MB} MB.`, "error");
        continue;
      }
      try {
        await DB.anexos.upload(pacienteId, clinicaId, file, categoria, autor);
        ok++;
      } catch {
        showToast(`Falha ao enviar "${file.name}".`, "error");
      }
    }
    if (ok) {
      await load();
      showToast(ok === 1 ? "Anexo enviado." : `${ok} anexos enviados.`, "success");
    }
    setEnviando(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const abrir = async (a: Anexo) => {
    const url = thumbs[a.id!] || (await DB.anexos.signedUrl(a.path));
    if (!url) return showToast("Não foi possível abrir o anexo.", "error");
    if (isImagem(a.tipo)) {
      setPreview({ anexo: a, url });
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const remover = async (a: Anexo) => {
    if (a.id == null) return;
    if (!(await confirm(`Remover "${a.nome}"?`, { danger: true, okLabel: "Remover" }))) return;
    try {
      await DB.anexos.remove(a.id, a.path);
      await load();
      showToast("Anexo removido.", "success");
    } catch {
      showToast("Não foi possível remover o anexo.", "error");
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setArrastando(false);
    if (e.dataTransfer.files?.length) enviarArquivos(e.dataTransfer.files);
  };

  const visiveis = filtro === "todos" ? lista : lista.filter((a) => a.categoria === filtro);

  return (
    <div>
      {/* Área de upload */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <label className="form-label" style={{ margin: 0 }}>Categoria do anexo</label>
          <select
            className="form-control"
            style={{ width: "auto", minWidth: 150 }}
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as Categoria)}
          >
            {CATEGORIAS.map((c) => (
              <option key={c.valor} value={c.valor}>{c.label}</option>
            ))}
          </select>
        </div>

        <div
          onClick={() => !enviando && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
          onDragLeave={() => setArrastando(false)}
          onDrop={onDrop}
          style={{
            border: `2px dashed ${arrastando ? "var(--primary)" : "var(--border)"}`,
            background: arrastando ? "var(--primary-light)" : "var(--bg2)",
            borderRadius: 10,
            padding: "26px 16px",
            textAlign: "center",
            cursor: enviando ? "default" : "pointer",
            transition: "border-color .15s, background .15s",
          }}
        >
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7"
            style={{ width: 30, height: 30, color: "var(--primary)", marginBottom: 6 }}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
          </svg>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
            {enviando ? "Enviando…" : "Clique ou arraste arquivos aqui"}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            Fotos, raio-x e documentos (PDF, imagens) · até {MAX_MB} MB cada
          </div>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*,application/pdf"
            style={{ display: "none" }}
            onChange={(e) => e.target.files && enviarArquivos(e.target.files)}
            disabled={enviando}
          />
        </div>
      </div>

      {/* Filtro por categoria */}
      {lista.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {(["todos", ...CATEGORIAS.map((c) => c.valor)] as const).map((f) => {
            const label = f === "todos" ? "Todos" : CATEGORIAS.find((c) => c.valor === f)!.label;
            const n = f === "todos" ? lista.length : lista.filter((a) => a.categoria === f).length;
            const ativo = filtro === f;
            return (
              <button
                key={f}
                onClick={() => setFiltro(f)}
                className="btn btn-sm"
                style={{
                  background: ativo ? "var(--primary)" : "var(--bg2)",
                  color: ativo ? "#fff" : "var(--text-muted)",
                  border: `1px solid ${ativo ? "var(--primary)" : "var(--border)"}`,
                }}
              >
                {label} <span style={{ opacity: 0.7 }}>({n})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Galeria */}
      {carregando ? (
        <div style={{ padding: 28, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
          Carregando anexos…
        </div>
      ) : visiveis.length === 0 ? (
        <EmptyState
          compact
          title={lista.length === 0 ? "Nenhum anexo" : "Nada nesta categoria"}
          hint="Fotos, radiografias e documentos do paciente ficam guardados aqui."
        />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 14 }}>
          {visiveis.slice().reverse().map((a) => (
            <div
              key={a.id}
              className="card"
              style={{ padding: 0, overflow: "hidden", border: "1px solid var(--border)", display: "flex", flexDirection: "column" }}
            >
              <button
                onClick={() => abrir(a)}
                title={a.nome}
                style={{
                  border: "none", padding: 0, cursor: "pointer", background: "var(--bg2)",
                  height: 110, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
                }}
              >
                {thumbs[a.id!] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumbs[a.id!]} alt={a.nome} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"
                    style={{ width: 38, height: 38, color: "var(--text-muted)" }}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                  </svg>
                )}
              </button>
              <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {a.nome}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                  <span className="badge badge-info" style={{ fontSize: 10 }}>
                    {CATEGORIAS.find((c) => c.valor === a.categoria)?.label ?? a.categoria}
                  </span>
                  <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{tamanhoLegivel(a.tamanho)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
                  <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                    {a.criadoEm ? new Date(a.criadoEm).toLocaleDateString("pt-BR") : ""}
                  </span>
                  <button className="icon-btn danger" title="Remover" onClick={() => remover(a)} style={{ width: 26, height: 26 }}>
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: 12, height: 12 }}>
                      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de preview de imagem */}
      {preview && (
        <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && setPreview(null)}>
          <div className="modal" style={{ maxWidth: 720 }}>
            <div className="modal-header">
              <span className="modal-title" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {preview.anexo.nome}
              </span>
              <button className="modal-close" onClick={() => setPreview(null)}>&times;</button>
            </div>
            <div className="modal-body" style={{ textAlign: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview.url} alt={preview.anexo.nome} style={{ maxWidth: "100%", maxHeight: "65vh", borderRadius: 8 }} />
            </div>
            <div className="modal-footer">
              <a className="btn btn-outline" href={preview.url} target="_blank" rel="noopener noreferrer">
                Abrir em nova aba
              </a>
              <button className="btn btn-primary" onClick={() => setPreview(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
