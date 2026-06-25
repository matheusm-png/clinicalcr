"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DB } from "@/lib/db";
import { ModeloAnamnese, Paciente } from "@/lib/types";
import Topbar from "@/components/Topbar";
import { useToast } from "@/components/Toast";
import SignaturePad, { SignaturePadHandle } from "@/components/SignaturePad";

function PreencherModelo() {
  const router = useRouter();
  const params = useSearchParams();
  const modeloId = params.get("modelo");
  const pacienteId = params.get("id");
  const { showToast } = useToast();

  const [modelo, setModelo] = useState<ModeloAnamnese | null>(null);
  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const padRef = useRef<SignaturePadHandle>(null);

  useEffect(() => {
    (async () => {
      const [m, p] = await Promise.all([
        modeloId ? DB.modelosAnamnese.get(modeloId) : Promise.resolve(null),
        pacienteId ? DB.pacientes.get(pacienteId) : Promise.resolve(null),
      ]);
      setModelo(m);
      setPaciente(p);
      setCarregando(false);
    })();
  }, [modeloId, pacienteId]);

  const setResp = (chave: string, v: string) => setRespostas((r) => ({ ...r, [chave]: v }));

  const salvar = async () => {
    if (!modelo || !paciente) return;
    const assinatura = padRef.current?.toDataURL();
    if (!assinatura) return showToast("Peça para o paciente assinar antes de salvar.", "error");
    setSalvando(true);
    try {
      await DB.anamneses.save({
        pacienteId: paciente.id as number,
        pacienteNome: paciente.nome,
        respostas: { ...respostas, _modelo: modelo.nome },
        assinatura,
        status: "Assinado",
        data: new Date().toISOString().split("T")[0],
      });
      showToast("Anamnese salva.", "success");
      router.push(`/admin/prontuario?id=${paciente.id}`);
    } catch {
      showToast("Não foi possível salvar a anamnese.", "error");
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) return <main className="page-content"><p style={{ color: "var(--text-muted)" }}>Carregando…</p></main>;
  if (!modelo) return <main className="page-content"><p style={{ color: "var(--text-muted)" }}>Modelo não encontrado.</p></main>;
  if (!paciente) return <main className="page-content"><p style={{ color: "var(--text-muted)" }}>Selecione um paciente para preencher.</p></main>;

  return (
    <main className="page-content">
      <div className="card" style={{ padding: 20, maxWidth: 760 }}>
        <h2 style={{ fontSize: 18, margin: "0 0 2px" }}>{modelo.nome}</h2>
        <p style={{ color: "var(--text-muted)", fontSize: 13, margin: "0 0 18px" }}>Paciente: <strong>{paciente.nome}</strong></p>

        {modelo.estrutura.map((sec, si) => (
          <div key={si} style={{ marginBottom: 18 }}>
            {sec.nome && <h3 style={{ fontSize: 14, borderBottom: "1px solid var(--border)", paddingBottom: 6, marginBottom: 12 }}>{sec.nome}</h3>}
            {sec.perguntas.map((p, pi) => {
              const chave = `${sec.nome || "secao" + si} — ${p.texto}`;
              return (
                <div className="form-group" key={pi}>
                  <label className="form-label">{p.texto}</label>
                  {p.tipo === "sim_nao" ? (
                    <div style={{ display: "flex", gap: 8 }}>
                      {["Sim", "Não"].map((op) => {
                        const ativo = respostas[chave] === op;
                        return (
                          <button key={op} type="button" className="btn btn-sm"
                            onClick={() => setResp(chave, op)}
                            style={{ background: ativo ? "var(--primary)" : "var(--bg2)", color: ativo ? "#fff" : "var(--text-muted)", border: `1px solid ${ativo ? "var(--primary)" : "var(--border)"}` }}>
                            {op}
                          </button>
                        );
                      })}
                    </div>
                  ) : p.tipo === "numero" ? (
                    <input type="number" className="form-control" value={respostas[chave] ?? ""} onChange={(e) => setResp(chave, e.target.value)} />
                  ) : (
                    <textarea className="form-control" rows={2} value={respostas[chave] ?? ""} onChange={(e) => setResp(chave, e.target.value)} />
                  )}
                </div>
              );
            })}
          </div>
        ))}

        <div className="form-group">
          <label className="form-label">Assinatura do paciente</label>
          <SignaturePad ref={padRef} />
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
          <button className="btn btn-outline" onClick={() => router.push(`/admin/prontuario?id=${paciente.id}`)}>Cancelar</button>
          <button className="btn btn-primary" onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar anamnese"}</button>
        </div>
      </div>
    </main>
  );
}

export default function ModeloAnamnesePreencherPage() {
  return (
    <>
      <Topbar title="Anamnese personalizada" />
      <Suspense fallback={<main className="page-content"><p style={{ color: "var(--text-muted)" }}>Carregando…</p></main>}>
        <PreencherModelo />
      </Suspense>
    </>
  );
}
