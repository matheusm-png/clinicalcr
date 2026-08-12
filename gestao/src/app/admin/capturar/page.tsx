"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DB } from "@/lib/db";
import Topbar from "@/components/Topbar";
import { useToast } from "@/components/Toast";
import { comprimirImagem } from "@/lib/imagem";

// ── Capturar ficha pelo celular ─────────────────────────────
// Fluxo pensado para a recepção: fotografa as páginas da ficha de papel
// aqui no celular e ENVIA — as fotos aparecem na tela "Importar ficha"
// do computador, onde a leitura por IA e a revisão continuam com teclado
// e tela grande. Nada além das fotos é criado neste passo.

export default function CapturarPage() {
  const { showToast } = useToast();
  const [clinicaId, setClinicaId] = useState<number | null>(null);
  const [fotos, setFotos] = useState<File[]>([]);
  const [label, setLabel] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviadas, setEnviadas] = useState(0); // total de lotes enviados nesta sessão
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    (async () => {
      const c = await DB.clinica.get();
      setClinicaId(c?.id ?? null);
    })();
  }, []);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const arr = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/"));
    if (arr.length) setFotos((p) => [...p, ...arr].slice(0, 8));
    e.target.value = "";
  };

  const enviar = async () => {
    if (!fotos.length) {
      showToast("Fotografe ao menos uma página da ficha.", "error");
      return;
    }
    if (!clinicaId) {
      showToast("Backend não conectado — não é possível enviar.", "error");
      return;
    }
    setEnviando(true);
    try {
      const blobs: Blob[] = [];
      for (const f of fotos) blobs.push(await comprimirImagem(f));
      await DB.capturas.enviar(clinicaId, blobs, label);
      setFotos([]);
      setLabel("");
      setEnviadas((n) => n + 1);
      showToast("Fotos enviadas! Já aparecem no computador em Importar ficha.", "success");
    } catch {
      showToast("Falha ao enviar as fotos. Verifique a internet e tente de novo.", "error");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <Topbar title="Capturar ficha" />
      <main className="page-content">
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <div className="card" style={{ padding: 20 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>📱 Fotografe aqui, continue no computador</h2>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
              Tire as fotos das páginas da ficha e toque em <strong>Enviar</strong>.
              Elas aparecem na tela <strong>Importar ficha</strong> do computador,
              onde a leitura por IA e a revisão continuam na tela grande.
            </p>

            <div className="form-group">
              <label className="form-label">Nome do paciente (opcional)</label>
              <input
                className="form-control"
                placeholder="Ajuda a identificar no computador"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>

            <input ref={inputRef} type="file" accept="image/*" capture="environment" multiple hidden onChange={onPick} />
            <button
              onClick={() => inputRef.current?.click()}
              style={{
                width: "100%", border: "2px dashed var(--primary)", borderRadius: 12,
                padding: "28px 16px", textAlign: "center", cursor: "pointer",
                background: "var(--primary-light)", marginBottom: 14, fontFamily: "inherit",
              }}
            >
              <div style={{ fontSize: 34, marginBottom: 4 }}>📷</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "var(--primary-darker)" }}>
                {fotos.length ? "Fotografar outra página" : "Fotografar a ficha"}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Até 8 fotos por ficha</div>
            </button>

            {fotos.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
                {fotos.map((f, i) => (
                  <div key={i} style={{ position: "relative" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={URL.createObjectURL(f)} alt={`Página ${i + 1}`}
                      style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }}
                    />
                    <button
                      onClick={() => setFotos((p) => p.filter((_, idx) => idx !== i))}
                      style={{
                        position: "absolute", top: -8, right: -8, width: 24, height: 24, borderRadius: "50%",
                        border: "none", background: "var(--danger)", color: "#fff", cursor: "pointer", fontSize: 14, lineHeight: 1,
                      }}
                      title="Remover"
                    >×</button>
                  </div>
                ))}
              </div>
            )}

            <button
              className="btn btn-primary"
              style={{ width: "100%", justifyContent: "center", fontSize: 15, padding: "12px 18px" }}
              onClick={enviar}
              disabled={enviando || !fotos.length}
            >
              {enviando ? "Enviando…" : `Enviar ${fotos.length ? `${fotos.length} foto(s)` : ""} para o computador`}
            </button>

            {enviadas > 0 && (
              <div style={{ marginTop: 14, fontSize: 13, color: "var(--success)", fontWeight: 600, textAlign: "center" }}>
                ✅ {enviadas} ficha{enviadas === 1 ? "" : "s"} enviada{enviadas === 1 ? "" : "s"} nesta sessão — pode fotografar a próxima.
              </div>
            )}
          </div>

          <div style={{ textAlign: "center", marginTop: 14 }}>
            <Link href="/admin/importar-ficha" style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Estou no computador → abrir Importar ficha
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
