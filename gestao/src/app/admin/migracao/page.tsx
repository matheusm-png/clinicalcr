"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DB } from "@/lib/db";
import { Paciente, TransacaoFinanceira, Agendamento } from "@/lib/types";
import Topbar from "@/components/Topbar";
import { useToast } from "@/components/Toast";

type Entidade = "pacientes" | "financeiro" | "agendamentos";

const norm = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

const parseData = (v: string): string => {
  const t = (v || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return "";
};

const parseValor = (v: string): number => {
  const t = (v || "").replace(/[^0-9,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : 0;
};

const parseHora = (v: string): { hora: number; min: number } => {
  const m = (v || "").match(/(\d{1,2})\D?(\d{2})?/);
  if (!m) return { hora: 8, min: 0 };
  return { hora: parseInt(m[1]) || 8, min: m[2] ? parseInt(m[2]) : 0 };
};

function parseRows(texto: string): { headers: string[]; rows: string[][] } {
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim());
  if (linhas.length < 2) return { headers: [], rows: [] };
  const delim = (linhas[0].match(/;/g)?.length ?? 0) > (linhas[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const corta = (l: string) => l.split(delim).map((c) => c.trim().replace(/^"(.*)"$/, "$1"));
  return { headers: corta(linhas[0]), rows: linhas.slice(1).map(corta) };
}

const ENTIDADES: { id: Entidade; label: string; desc: string; colunas: string }[] = [
  { id: "pacientes", label: "Pacientes", desc: "Cadastro dos pacientes", colunas: "nome, cpf, telefone, nascimento, email, plano" },
  { id: "financeiro", label: "Financeiro", desc: "Receitas e despesas", colunas: "tipo, descrição, valor, categoria, data, status, forma" },
  { id: "agendamentos", label: "Agenda", desc: "Consultas (vincula ao paciente pelo nome)", colunas: "paciente, data, hora, procedimento" },
];

export default function MigracaoPage() {
  const { showToast } = useToast();
  const [entidade, setEntidade] = useState<Entidade>("pacientes");
  const [csvText, setCsvText] = useState("");
  const [importando, setImportando] = useState(false);
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [resultado, setResultado] = useState<string | null>(null);

  useEffect(() => {
    DB.pacientes.list().then(setPacientes);
  }, []);

  const onArquivo = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result || ""));
    reader.readAsText(file);
  };

  // Parse + monta os objetos da entidade escolhida (com contagem de descartados).
  const preview = useMemo(() => {
    const { headers, rows } = parseRows(csvText);
    if (!headers.length) return { itens: [] as any[], descartados: 0, motivo: "" };
    const cab = headers.map(norm);
    const idx = (...nomes: string[]) => cab.findIndex((c) => nomes.includes(c));

    let descartados = 0;
    let motivo = "";

    if (entidade === "pacientes") {
      const iNome = idx("nome", "paciente", "nome completo");
      const iCpf = idx("cpf");
      const iTel = idx("telefone", "tel", "celular", "fone", "whatsapp", "contato");
      const iNasc = idx("nascimento", "data de nascimento", "data nascimento", "dn", "nasc");
      const iEmail = idx("email", "e-mail");
      const iPlano = idx("plano", "convenio", "convênio");
      const itens: Paciente[] = [];
      rows.forEach((col) => {
        const nome = iNome >= 0 ? col[iNome] : col[0];
        if (!nome) { descartados++; motivo = "linhas sem nome"; return; }
        itens.push({
          nome,
          cpf: iCpf >= 0 ? col[iCpf] ?? "" : "",
          tel: iTel >= 0 ? col[iTel] ?? "" : "",
          nascimento: iNasc >= 0 ? parseData(col[iNasc] ?? "") : "",
          email: iEmail >= 0 ? col[iEmail] ?? "" : "",
          plano: iPlano >= 0 ? col[iPlano] || "Particular" : "Particular",
          status: "Ativo",
        });
      });
      return { itens, descartados, motivo };
    }

    if (entidade === "financeiro") {
      const iTipo = idx("tipo");
      const iDesc = idx("descricao", "descrição", "historico", "histórico", "lancamento", "lançamento");
      const iValor = idx("valor", "total", "preco", "preço");
      const iCat = idx("categoria", "cat");
      const iData = idx("data", "vencimento", "pagamento");
      const iStatus = idx("status", "situacao", "situação");
      const iForma = idx("forma", "forma de pagamento", "pagamento");
      const itens: TransacaoFinanceira[] = [];
      rows.forEach((col) => {
        const descricao = iDesc >= 0 ? col[iDesc] : col[0];
        const valor = iValor >= 0 ? parseValor(col[iValor]) : 0;
        if (!descricao || valor <= 0) { descartados++; motivo = "linhas sem descrição ou valor"; return; }
        const tipoRaw = norm(iTipo >= 0 ? col[iTipo] ?? "" : "");
        const statusRaw = norm(iStatus >= 0 ? col[iStatus] ?? "" : "");
        itens.push({
          tipo: /desp|saida|saída|debito|débito/.test(tipoRaw) ? "despesa" : "receita",
          descricao,
          valor,
          categoria: iCat >= 0 ? col[iCat] || "Geral" : "Geral",
          data: iData >= 0 ? parseData(col[iData] ?? "") || new Date().toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
          status: /pend|aberto|a receber|a pagar/.test(statusRaw) ? "pendente" : "pago",
          formaPagto: iForma >= 0 ? col[iForma] || undefined : undefined,
        });
      });
      return { itens, descartados, motivo };
    }

    // agendamentos
    const iPac = idx("paciente", "nome", "cliente");
    const iData = idx("data", "dia");
    const iHora = idx("hora", "horario", "horário");
    const iProc = idx("procedimento", "proc", "servico", "serviço", "descricao", "descrição");
    const itens: Agendamento[] = [];
    rows.forEach((col) => {
      const nome = iPac >= 0 ? col[iPac] : col[0];
      const data = iData >= 0 ? parseData(col[iData] ?? "") : "";
      if (!nome || !data) { descartados++; motivo = "linhas sem paciente ou data válida"; return; }
      const pac = pacientes.find((p) => norm(p.nome) === norm(nome));
      if (!pac) { descartados++; motivo = "pacientes não encontrados no cadastro (importe os pacientes primeiro)"; return; }
      const { hora, min } = parseHora(iHora >= 0 ? col[iHora] ?? "" : "");
      itens.push({
        paciente: pac.nome,
        pacienteId: pac.id,
        proc: iProc >= 0 ? col[iProc] || "Consulta" : "Consulta",
        data,
        hora,
        min,
        dur: 30,
        status: "confirmado",
      });
    });
    return { itens, descartados, motivo };
  }, [csvText, entidade, pacientes]);

  const importar = async () => {
    if (preview.itens.length === 0) {
      showToast("Nenhum registro válido encontrado no CSV.", "error");
      return;
    }
    setImportando(true);
    setResultado(null);
    try {
      let n = 0;
      if (entidade === "pacientes") n = await DB.pacientes.importar(preview.itens);
      else if (entidade === "financeiro") n = await DB.financeiro.importar(preview.itens);
      else n = await DB.agendamentos.importar(preview.itens);
      setResultado(`${n} registro(s) importado(s) com sucesso${preview.descartados ? ` · ${preview.descartados} descartado(s)` : ""}.`);
      setCsvText("");
      if (entidade === "agendamentos" || entidade === "pacientes") setPacientes(await DB.pacientes.list());
      showToast(`${n} registro(s) importado(s).`, "success");
    } catch {
      showToast("Falha ao importar. Confira o arquivo e tente novamente.", "error");
    } finally {
      setImportando(false);
    }
  };

  const ent = ENTIDADES.find((e) => e.id === entidade)!;
  const destino = entidade === "financeiro" ? "/admin/financeiro" : entidade === "agendamentos" ? "/admin/agenda" : "/admin/pacientes";

  return (
    <>
      <Topbar title="Migração de dados" />

      <main className="page-content">
        <div className="card mb-6">
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
            Importe seus dados de um sistema antigo ou planilha, em 3 passos. Aceita <strong>.csv</strong> (separado por vírgula ou ponto-e-vírgula);
            a primeira linha deve ser o cabeçalho. Dica: importe os <strong>pacientes primeiro</strong> — a agenda se vincula a eles pelo nome.
          </p>
        </div>

        {/* Passo 1 — o que importar */}
        <div className="card mb-6">
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 12 }}>
            Passo 1 · O que você quer importar?
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            {ENTIDADES.map((e) => (
              <button
                key={e.id}
                onClick={() => { setEntidade(e.id); setResultado(null); }}
                style={{
                  textAlign: "left", padding: "14px 16px", borderRadius: "var(--radius)", cursor: "pointer",
                  border: `2px solid ${entidade === e.id ? "var(--primary)" : "var(--border)"}`,
                  background: entidade === e.id ? "var(--primary-light)" : "transparent",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 14, color: entidade === e.id ? "var(--primary-darker)" : "var(--text)" }}>{e.label}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{e.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Passo 2 — enviar o arquivo */}
        <div className="card mb-6">
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 12 }}>
            Passo 2 · Envie o CSV de {ent.label.toLowerCase()}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
            Colunas reconhecidas: <strong>{ent.colunas}</strong> (nomes flexíveis; colunas extras são ignoradas).
          </div>
          <div className="form-group">
            <input type="file" accept=".csv,text/csv" className="form-control" onChange={(e) => onArquivo(e.target.files?.[0])} />
          </div>
          <div className="form-group">
            <label className="form-label">Ou cole o conteúdo do CSV</label>
            <textarea
              className="form-control"
              rows={6}
              placeholder={`${ent.colunas.replace(/, /g, ";")}\n…`}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              style={{ fontFamily: "monospace", fontSize: 12 }}
            />
          </div>
        </div>

        {/* Passo 3 — conferir e importar */}
        {csvText.trim() && (
          <div className="card mb-6">
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 12 }}>
              Passo 3 · Confira e importe
            </div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
              <div><span style={{ fontSize: 22, fontWeight: 800, color: "#16A34A" }}>{preview.itens.length}</span> <span style={{ fontSize: 12, color: "var(--text-muted)" }}>válidos</span></div>
              {preview.descartados > 0 && (
                <div><span style={{ fontSize: 22, fontWeight: 800, color: "#D97706" }}>{preview.descartados}</span> <span style={{ fontSize: 12, color: "var(--text-muted)" }}>descartados ({preview.motivo})</span></div>
              )}
            </div>

            {preview.itens.length > 0 && (
              <div className="table-wrapper" style={{ maxHeight: 260, overflow: "auto", marginBottom: 14 }}>
                <table>
                  <thead>
                    <tr>
                      {entidade === "pacientes" && <><th>Nome</th><th>CPF</th><th>Telefone</th><th>Nascimento</th></>}
                      {entidade === "financeiro" && <><th>Tipo</th><th>Descrição</th><th>Valor</th><th>Data</th><th>Status</th></>}
                      {entidade === "agendamentos" && <><th>Paciente</th><th>Data</th><th>Hora</th><th>Procedimento</th></>}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.itens.slice(0, 30).map((it: any, i: number) => (
                      <tr key={i}>
                        {entidade === "pacientes" && <><td>{it.nome}</td><td>{it.cpf || "—"}</td><td>{it.tel || "—"}</td><td>{it.nascimento || "—"}</td></>}
                        {entidade === "financeiro" && <><td>{it.tipo}</td><td>{it.descricao}</td><td>{it.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td><td>{it.data}</td><td>{it.status}</td></>}
                        {entidade === "agendamentos" && <><td>{it.paciente}</td><td>{it.data}</td><td>{String(it.hora).padStart(2, "0")}:{String(it.min).padStart(2, "0")}</td><td>{it.proc}</td></>}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.itens.length > 30 && <div style={{ fontSize: 11, color: "var(--text-muted)", padding: 8 }}>…e mais {preview.itens.length - 30} registro(s).</div>}
              </div>
            )}

            <button className="btn btn-primary" disabled={importando || preview.itens.length === 0} onClick={importar}>
              {importando ? "Importando…" : `Importar ${preview.itens.length} ${ent.label.toLowerCase()}`}
            </button>
          </div>
        )}

        {resultado && (
          <div className="card" style={{ borderLeft: "3px solid #16A34A" }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>✓ {resultado}</div>
            <Link href={destino} className="btn btn-outline btn-sm">Ver {ent.label.toLowerCase()}</Link>
          </div>
        )}
      </main>
    </>
  );
}
