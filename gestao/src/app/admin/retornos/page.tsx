"use client";

import { useEffect, useMemo, useState } from "react";
import { DB } from "@/lib/db";
import { Paciente } from "@/lib/types";
import Topbar from "@/components/Topbar";
import EmptyState from "@/components/EmptyState";
import { useToast } from "@/components/Toast";

const hoje0 = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

// Dias entre hoje e a data ISO (yyyy-mm-dd). Negativo = atrasado.
function diasAte(iso?: string): number | null {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  return Math.round((d.getTime() - hoje0().getTime()) / 86400000);
}

function statusRetorno(dias: number | null) {
  if (dias === null) return null;
  if (dias < 0) return { label: `Atrasado ${Math.abs(dias)}d`, cls: "badge-danger" };
  if (dias === 0) return { label: "Hoje", cls: "badge-warning" };
  if (dias <= 7) return { label: `Em ${dias}d`, cls: "badge-warning" };
  return { label: `Em ${dias}d`, cls: "badge-info" };
}

const soDigitos = (s?: string) => (s || "").replace(/\D/g, "");

export default function RetornosPage() {
  const { showToast } = useToast();
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [clinicaNome, setClinicaNome] = useState("");
  const [busca, setBusca] = useState("");
  const [salvandoId, setSalvandoId] = useState<number | null>(null);

  useEffect(() => { load(); }, []);
  const load = async () => {
    const [ps, c] = await Promise.all([DB.pacientes.list(), DB.clinica.get()]);
    setPacientes(ps);
    setClinicaNome(c?.nome || "");
  };

  const setRevisao = async (p: Paciente, valor: string) => {
    setSalvandoId(p.id!);
    try {
      await DB.pacientes.save({ ...p, proximaRevisao: valor });
      await load();
      showToast(valor ? "Retorno agendado." : "Retorno removido.", "success");
    } catch {
      showToast("Não foi possível salvar.", "error");
    } finally {
      setSalvandoId(null);
    }
  };

  const whatsapp = (p: Paciente) => {
    const tel = soDigitos(p.tel);
    const primeiro = p.nome.split(" ")[0];
    const msg = encodeURIComponent(
      `Olá ${primeiro}! Aqui é da ${clinicaNome || "clínica"}. Está na hora da sua revisão odontológica. Vamos agendar seu retorno?`,
    );
    const fone = tel.length >= 11 ? `55${tel}` : tel;
    window.open(`https://wa.me/${fone}?text=${msg}`, "_blank", "noopener,noreferrer");
  };

  // Pendentes = têm data e vencem em até 7 dias (ou atrasados). Ordenados pela data.
  const comData = pacientes
    .filter((p) => p.proximaRevisao)
    .map((p) => ({ p, dias: diasAte(p.proximaRevisao) }))
    .sort((a, b) => (a.dias ?? 0) - (b.dias ?? 0));
  const pendentes = comData.filter((x) => x.dias !== null && x.dias <= 7);
  const atrasados = comData.filter((x) => x.dias !== null && x.dias < 0).length;
  const prox7 = comData.filter((x) => x.dias !== null && x.dias >= 0 && x.dias <= 7).length;

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return q ? pacientes.filter((p) => p.nome.toLowerCase().includes(q)) : pacientes;
  }, [pacientes, busca]);

  return (
    <>
      <Topbar title="Retornos" />
      <main className="page-content">
        {/* Resumo */}
        <div className="stats-grid" style={{ marginBottom: 20 }}>
          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>Atrasados</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: "#EF4444", marginTop: 4 }}>{atrasados}</div>
          </div>
          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>Próximos 7 dias</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: "#F59E0B", marginTop: 4 }}>{prox7}</div>
          </div>
          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>Retornos agendados</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: "var(--primary)", marginTop: 4 }}>{comData.length}</div>
          </div>
        </div>

        {/* Pendentes (call list) */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <span className="card-title">Pendentes de contato</span>
          </div>
          {pendentes.length === 0 ? (
            <EmptyState compact title="Nenhum retorno pendente" hint="Pacientes com revisão atrasada ou nos próximos 7 dias aparecem aqui." />
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr><th>Paciente</th><th>Telefone</th><th>Revisão</th><th>Situação</th><th>Ações</th></tr>
                </thead>
                <tbody>
                  {pendentes.map(({ p, dias }) => {
                    const st = statusRetorno(dias);
                    return (
                      <tr key={p.id}>
                        <td><strong>{p.nome}</strong></td>
                        <td>{p.tel || "—"}</td>
                        <td>{p.proximaRevisao ? new Date(p.proximaRevisao + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</td>
                        <td>{st && <span className={`badge ${st.cls}`}>{st.label}</span>}</td>
                        <td>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <button className="btn btn-sm" style={{ background: "#25D366", color: "#fff" }} onClick={() => whatsapp(p)} disabled={!soDigitos(p.tel)}>
                              WhatsApp
                            </button>
                            <button className="btn btn-outline btn-sm" onClick={() => setRevisao(p, "")} disabled={salvandoId === p.id}>
                              Concluir
                            </button>
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

        {/* Gerenciar revisões de todos os pacientes */}
        <div className="card">
          <div className="card-header" style={{ gap: 12, flexWrap: "wrap" }}>
            <span className="card-title">Agendar / atualizar retornos</span>
            <input
              className="form-control"
              style={{ width: 240 }}
              placeholder="Buscar paciente…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Paciente</th><th>Telefone</th><th>Próxima revisão</th></tr>
              </thead>
              <tbody>
                {filtrados.map((p) => (
                  <tr key={p.id}>
                    <td><strong>{p.nome}</strong></td>
                    <td>{p.tel || "—"}</td>
                    <td>
                      <input
                        type="date"
                        className="form-control"
                        style={{ width: 170 }}
                        value={p.proximaRevisao || ""}
                        disabled={salvandoId === p.id}
                        onChange={(e) => setRevisao(p, e.target.value)}
                      />
                    </td>
                  </tr>
                ))}
                {filtrados.length === 0 && (
                  <tr><td colSpan={3} style={{ textAlign: "center", padding: 20, color: "var(--text-muted)" }}>Nenhum paciente encontrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </>
  );
}
