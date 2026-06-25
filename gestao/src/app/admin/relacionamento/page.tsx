"use client";

import { useEffect, useMemo, useState } from "react";
import { DB } from "@/lib/db";
import { Agendamento, Paciente, Profissional } from "@/lib/types";
import Topbar from "@/components/Topbar";
import EmptyState from "@/components/EmptyState";
import { useToast } from "@/components/Toast";

const soDigitos = (s?: string) => (s || "").replace(/\D/g, "");
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fmtData = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return d && m ? `${d}/${m}/${y?.slice(2)}` : iso;
};

// Estágios do funil. recuperacao: undefined → 0; 'contatado' → 1; 'remarcado' → 2; 'recuperado' → 3.
type Stage = undefined | "contatado" | "remarcado" | "recuperado";
const STAGE_KEYS: Stage[] = [undefined, "contatado", "remarcado", "recuperado"];
const stageIndex = (r?: string) => Math.max(0, STAGE_KEYS.indexOf((r as Stage) ?? undefined));

// Presets de período (sobre a data absoluta da consulta).
function periodoPreset(preset: string): { de: string; ate: string } {
  const hoje = new Date();
  const ini = new Date(hoje);
  if (preset === "30d") ini.setDate(hoje.getDate() - 30);
  else if (preset === "90d") ini.setDate(hoje.getDate() - 90);
  else if (preset === "ano") { ini.setMonth(0); ini.setDate(1); }
  else return { de: "1900-01-01", ate: "2999-12-31" }; // tudo
  // até hoje + 30 dias (para incluir remarcações futuras)
  const fim = new Date(hoje); fim.setDate(hoje.getDate() + 30);
  return { de: ymd(ini), ate: ymd(fim) };
}

export default function RelacionamentoPage() {
  const { showToast } = useToast();
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [clinicaNome, setClinicaNome] = useState("");
  const [preset, setPreset] = useState("90d");
  const [salvandoId, setSalvandoId] = useState<number | null>(null);

  useEffect(() => { load(); }, []);
  const load = async () => {
    const [ags, ps, profs, c] = await Promise.all([
      DB.agendamentos.list(), DB.pacientes.list(), DB.profissionais.list(), DB.clinica.get(),
    ]);
    setAgendamentos(ags);
    setPacientes(ps);
    setProfissionais(profs);
    setClinicaNome(c?.nome || "");
  };

  const { de, ate } = useMemo(() => periodoPreset(preset), [preset]);
  const pacienteDe = (a: Agendamento) =>
    pacientes.find((p) => (a.pacienteId && p.id === a.pacienteId) || p.nome === a.paciente);
  const nomeProf = (id?: number) => profissionais.find((p) => p.id === id)?.nome;

  const noPeriodo = (a: Agendamento) => a.data >= de && a.data <= ate;
  const faltas = agendamentos.filter((a) => !a.cancelado && a.presenca === "faltou" && noPeriodo(a));
  const desmarcados = agendamentos.filter((a) => a.cancelado && noPeriodo(a));

  const mover = async (a: Agendamento, delta: number) => {
    const novo = Math.min(STAGE_KEYS.length - 1, Math.max(0, stageIndex(a.recuperacao) + delta));
    setSalvandoId(a.id ?? null);
    try {
      await DB.agendamentos.save({ ...a, recuperacao: STAGE_KEYS[novo] });
      await load();
    } catch {
      showToast("Não foi possível atualizar.", "error");
    } finally {
      setSalvandoId(null);
    }
  };

  const whatsapp = (a: Agendamento, tipo: "falta" | "desmarcou") => {
    const p = pacienteDe(a);
    const tel = soDigitos(p?.tel);
    if (!tel) { showToast("Paciente sem telefone cadastrado.", "error"); return; }
    const primeiro = (p?.nome || a.paciente).split(" ")[0];
    const corpo = tipo === "falta"
      ? `Olá ${primeiro}! Notamos que você não pôde comparecer à sua consulta na ${clinicaNome || "clínica"}. Podemos remarcar um novo horário para você?`
      : `Olá ${primeiro}! Vimos que sua consulta na ${clinicaNome || "clínica"} foi desmarcada. Quer que a gente agende um novo horário?`;
    const fone = tel.length >= 11 ? `55${tel}` : tel;
    window.open(`https://wa.me/${fone}?text=${encodeURIComponent(corpo)}`, "_blank", "noopener,noreferrer");
  };

  const colunas = (primeiraLabel: string) => [
    primeiraLabel, "Contato realizado", "Remarcado", "Compareceu",
  ];

  function Kanban({ titulo, descricao, lista, primeiraLabel, tipo }: {
    titulo: string; descricao: string; lista: Agendamento[]; primeiraLabel: string; tipo: "falta" | "desmarcou";
  }) {
    const cols = colunas(primeiraLabel);
    return (
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title">{titulo} <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>({lista.length})</span></span>
          <span className="text-muted" style={{ fontSize: 12 }}>{descricao}</span>
        </div>
        {lista.length === 0 ? (
          <EmptyState compact title="Nada por aqui" hint="Nenhum registro no período selecionado." />
        ) : (
          <div style={{ display: "flex", gap: 12, overflowX: "auto", padding: "4px 2px 8px" }}>
            {cols.map((colNome, ci) => {
              const itens = lista.filter((a) => stageIndex(a.recuperacao) === ci);
              return (
                <div key={ci} style={{ flex: "0 0 220px", minWidth: 220, background: "var(--bg2, #f8fafc)", borderRadius: 10, padding: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <strong style={{ fontSize: 12 }}>{colNome}</strong>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", background: "var(--bg, #fff)", borderRadius: 10, padding: "1px 8px" }}>{itens.length}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {itens.map((a) => {
                      const p = pacienteDe(a);
                      const idx = stageIndex(a.recuperacao);
                      return (
                        <div key={a.id} style={{ background: "var(--bg, #fff)", border: "1px solid var(--border)", borderRadius: 8, padding: 10 }}>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{p?.nome || a.paciente || "—"}</div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                            {fmtData(a.data)} · {a.proc || "—"}
                          </div>
                          {nomeProf(a.profissionalId) && (
                            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{nomeProf(a.profissionalId)}</div>
                          )}
                          <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center" }}>
                            <button className="btn btn-sm" style={{ background: "#25D366", color: "#fff", padding: "4px 8px" }} onClick={() => whatsapp(a, tipo)} title="Chamar no WhatsApp">
                              <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 14, height: 14 }}><path d="M12 2a10 10 0 0 0-8.5 15.3L2 22l4.8-1.5A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-2.8.9.9-2.7-.2-.3A8 8 0 1 1 12 20zm4.4-5.8c-.2-.1-1.4-.7-1.6-.8s-.4-.1-.5.1-.6.8-.8 1-.3.2-.5.1a6.5 6.5 0 0 1-3.2-2.8c-.2-.4.2-.4.6-1.2 0-.2 0-.3-.1-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.7.3 2.8 2.8 0 0 0-.9 2.1 4.9 4.9 0 0 0 1 2.6 11 11 0 0 0 4.3 3.8c1.6.6 1.8.5 2.2.5a2.4 2.4 0 0 0 1.6-1.1 2 2 0 0 0 .1-1.1c0-.1-.2-.2-.4-.3z"/></svg>
                            </button>
                            <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                              <button className="btn btn-outline btn-sm" style={{ padding: "4px 8px" }} disabled={idx === 0 || salvandoId === a.id} onClick={() => mover(a, -1)} title="Voltar etapa">←</button>
                              <button className="btn btn-outline btn-sm" style={{ padding: "4px 8px" }} disabled={idx === STAGE_KEYS.length - 1 || salvandoId === a.id} onClick={() => mover(a, +1)} title="Avançar etapa">→</button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {itens.length === 0 && <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", padding: "10px 0" }}>—</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <Topbar title="Recuperação de pacientes" />
      <main className="page-content">
        <div className="card mb-6">
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Período:</span>
            {([
              { k: "30d", label: "Últimos 30 dias" },
              { k: "90d", label: "Últimos 90 dias" },
              { k: "ano", label: "Este ano" },
              { k: "tudo", label: "Tudo" },
            ]).map((o) => (
              <button key={o.k} className={`btn btn-sm ${preset === o.k ? "btn-primary" : "btn-outline"}`} onClick={() => setPreset(o.k)}>
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <Kanban
          titulo="Faltas"
          descricao="Pacientes que não compareceram"
          lista={faltas}
          primeiraLabel="Faltou"
          tipo="falta"
        />
        <Kanban
          titulo="Desmarcados"
          descricao="Consultas desmarcadas pelo paciente"
          lista={desmarcados}
          primeiraLabel="Desmarcou"
          tipo="desmarcou"
        />
      </main>
    </>
  );
}
