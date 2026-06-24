"use client";

import { useEffect, useRef, useState } from "react";
import { DB } from "@/lib/db";
import { Evolucao } from "@/lib/types";
import { useToast } from "@/components/Toast";
import EmptyState from "@/components/EmptyState";

export default function EvolucoesTab({ pacienteId, autor }: { pacienteId: number; autor?: string }) {
  const { showToast, confirm } = useToast();
  const [lista, setLista] = useState<Evolucao[]>([]);
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);

  // Gravação de voz
  const [gravando, setGravando] = useState(false);
  const [processando, setProcessando] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => { load(); }, [pacienteId]);
  const load = async () => setLista(await DB.evolucoes.list(pacienteId));

  const salvar = async () => {
    if (!texto.trim()) return showToast("Escreva ou dite a evolução.", "error");
    setSalvando(true);
    try {
      await DB.evolucoes.save({ pacienteId, texto: texto.trim(), autor });
      setTexto("");
      await load();
      showToast("Evolução registrada.", "success");
    } catch {
      showToast("Não foi possível salvar.", "error");
    } finally {
      setSalvando(false);
    }
  };

  const remover = async (e: Evolucao) => {
    if (e.id == null) return;
    if (!(await confirm("Remover esta evolução?", { danger: true, okLabel: "Remover" }))) return;
    try {
      await DB.evolucoes.remove(e.id);
      await load();
      showToast("Evolução removida.", "success");
    } catch {
      showToast("Não foi possível remover.", "error");
    }
  };

  const iniciarGravacao = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (ev) => { if (ev.data.size > 0) chunksRef.current.push(ev.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await transcrever(blob);
      };
      rec.start();
      recorderRef.current = rec;
      setGravando(true);
    } catch {
      showToast("Não foi possível acessar o microfone.", "error");
    }
  };

  const pararGravacao = () => {
    recorderRef.current?.stop();
    setGravando(false);
    setProcessando(true);
  };

  const transcrever = async (blob: Blob) => {
    try {
      const fd = new FormData();
      fd.append("audio", blob, "evolucao.webm");
      const r = await fetch("/api/ai/transcrever", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      const novo = j.evolucao || j.transcricao || "";
      setTexto((t) => (t ? t + "\n" + novo : novo));
      showToast("Transcrição pronta — revise antes de salvar.", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Falha na transcrição.", "error");
    } finally {
      setProcessando(false);
    }
  };

  return (
    <div>
      {/* Nova evolução */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
          <label className="form-label" style={{ margin: 0 }}>Nova evolução</label>
          {gravando ? (
            <button className="btn btn-danger btn-sm" onClick={pararGravacao}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff", display: "inline-block", marginRight: 6, animation: "pulse 1s infinite" }} />
              Parar gravação
            </button>
          ) : (
            <button className="btn btn-outline btn-sm" onClick={iniciarGravacao} disabled={processando}>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
                <rect x="9" y="2" width="6" height="12" rx="3" />
                <path d="M5 10a7 7 0 0 0 14 0M12 17v4" />
              </svg>
              {processando ? "Transcrevendo…" : "Ditar (IA)"}
            </button>
          )}
        </div>
        <textarea
          className="form-control"
          rows={4}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Descreva o atendimento, ou use o botão Ditar para falar e a IA estruturar."
        />
        <div style={{ marginTop: 10, textAlign: "right" }}>
          <button className="btn btn-primary" onClick={salvar} disabled={salvando || !texto.trim()}>
            {salvando ? "Salvando…" : "Registrar evolução"}
          </button>
        </div>
      </div>

      {/* Histórico (timeline) */}
      {lista.length === 0 ? (
        <EmptyState compact title="Nenhuma evolução registrada" hint="As anotações de cada atendimento aparecem aqui." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {lista.slice().reverse().map((e) => (
            <div key={e.id} style={{ borderLeft: "3px solid var(--primary)", background: "var(--bg2)", borderRadius: 8, padding: "12px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
                  {e.criadoEm ? new Date(e.criadoEm).toLocaleString("pt-BR") : ""}{e.autor ? ` · ${e.autor}` : ""}
                </span>
                <button className="icon-btn danger" title="Remover" onClick={() => remover(e)} style={{ width: 28, height: 28 }}>
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: 13, height: 13 }}>
                    <path d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.5 }}>{e.texto}</div>
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: .3 } }`}</style>
    </div>
  );
}
