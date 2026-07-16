"use client";

import { useEffect, useMemo, useState } from "react";
import { DB } from "@/lib/db";
import { Auditoria } from "@/lib/types";
import Topbar from "@/components/Topbar";
import EmptyState from "@/components/EmptyState";
import { exportarClinica, baixarJson } from "@/lib/lgpd/exportar";

const norm = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
const fmt = (s?: string) => (s ? new Date(s).toLocaleString("pt-BR") : "—");

const ACOES: Record<string, { label: string; cor: string }> = {
  criacao: { label: "Criação", cor: "var(--success)" },
  edicao: { label: "Edição", cor: "var(--warning)" },
  exclusao: { label: "Exclusão", cor: "var(--danger)" },
  acesso: { label: "Acesso", cor: "#0ea5e9" },
  exportacao: { label: "Exportação", cor: "#8b5cf6" },
};
const acaoInfo = (a: string) => ACOES[a] ?? { label: a, cor: "var(--text-muted)" };

export default function AuditoriaPage() {
  const [logs, setLogs] = useState<Auditoria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroAcao, setFiltroAcao] = useState("");
  const [backupando, setBackupando] = useState(false);

  useEffect(() => {
    (async () => {
      setLogs(await DB.auditoria.list(500));
      setCarregando(false);
    })();
  }, []);

  const filtrados = useMemo(() => {
    const q = norm(busca);
    return logs.filter((l) => {
      if (filtroAcao && l.acao !== filtroAcao) return false;
      if (!q) return true;
      return norm(`${l.usuarioNome ?? ""} ${l.detalhe ?? ""} ${l.entidade}`).includes(q);
    });
  }, [logs, busca, filtroAcao]);

  const baixarCSV = () => {
    const linhas = [
      ["Data/hora", "Usuário", "Ação", "Entidade", "ID", "Detalhe"],
      ...filtrados.map((l) => [
        fmt(l.criadoEm),
        l.usuarioNome || "Sistema",
        acaoInfo(l.acao).label,
        l.entidade,
        String(l.entidadeId ?? ""),
        l.detalhe || "",
      ]),
    ];
    const csv = "﻿" + linhas.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `auditoria-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Topbar title="Auditoria (LGPD)">
        <button className="btn btn-outline" onClick={baixarCSV} disabled={!filtrados.length}>
          Exportar CSV
        </button>
        <button
          className="btn btn-primary"
          disabled={backupando}
          onClick={async () => {
            setBackupando(true);
            try {
              const dados = await exportarClinica();
              baixarJson(dados, `backup-clinica-${new Date().toISOString().slice(0, 10)}.json`);
              DB.auditoria.registrar("exportacao", "clinica", undefined, "Backup completo da clínica");
              setLogs(await DB.auditoria.list(500));
            } finally {
              setBackupando(false);
            }
          }}
        >
          {backupando ? "Gerando…" : "Backup completo"}
        </button>
      </Topbar>

      <main className="page-content">
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16, maxWidth: 720 }}>
          Registro de quem criou, alterou, excluiu ou acessou dados de pacientes — a
          rastreabilidade exigida pela LGPD. As alterações em pacientes são registradas
          automaticamente pelo sistema; os acessos, ao abrir um prontuário.
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
          <input
            className="form-control"
            style={{ maxWidth: 320 }}
            placeholder="Buscar por usuário, paciente…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <select className="form-control" style={{ width: "auto" }} value={filtroAcao} onChange={(e) => setFiltroAcao(e.target.value)}>
            <option value="">Todas as ações</option>
            {Object.entries(ACOES).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>

        {carregando ? (
          <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Carregando…</div>
        ) : filtrados.length === 0 ? (
          <EmptyState
            title="Nenhum registro"
            hint={logs.length === 0 ? "Ainda não há eventos de auditoria." : "Nenhum evento corresponde ao filtro."}
          />
        ) : (
          <div className="card table-wrapper" style={{ padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Data/hora</th>
                  <th>Usuário</th>
                  <th>Ação</th>
                  <th>Registro</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((l) => {
                  const info = acaoInfo(l.acao);
                  return (
                    <tr key={l.id}>
                      <td style={{ whiteSpace: "nowrap", fontSize: 12.5 }}>{fmt(l.criadoEm)}</td>
                      <td>{l.usuarioNome || <span style={{ color: "var(--text-muted)" }}>Sistema</span>}</td>
                      <td>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 10px",
                            borderRadius: 999,
                            fontSize: 11.5,
                            fontWeight: 700,
                            color: "#fff",
                            background: info.cor,
                          }}
                        >
                          {info.label}
                        </span>
                      </td>
                      <td style={{ fontSize: 13 }}>
                        {l.detalhe || "—"}
                        <span style={{ color: "var(--text-muted)" }}>
                          {" "}· {l.entidade}{l.entidadeId ? ` #${l.entidadeId}` : ""}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
