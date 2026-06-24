import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aiChat, aiConfigurado, type AiMessage } from "@/lib/ai";

const hoje = () => new Date().toISOString().split("T")[0];

// Monta um retrato compacto da clínica usando a sessão do usuário (RLS isola por clínica
// E respeita permissões — ex.: secretária não enxerga financeiro).
async function montarContexto(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  const [pac, ag, fin, contas, parc, est, orc] = await Promise.all([
    supabase.from("pacientes").select("status"),
    supabase.from("agendamentos").select("paciente, proc, dia, hora, min, status"),
    supabase.from("transacoes_financeiras").select("tipo, valor, status, data"),
    supabase.from("contas_receber").select("status, valor_total"),
    supabase.from("parcelas").select("valor, pago, vencimento"),
    supabase.from("itens_estoque").select("nome, quantidade, minimo"),
    supabase.from("orcamentos").select("status, total"),
  ]);

  const pacientes = pac.data ?? [];
  const ativos = pacientes.filter((p: any) => p.status === "Ativo").length;

  const fins = fin.data ?? [];
  const recebido = fins.filter((f: any) => f.tipo === "receita" && f.status === "pago").reduce((s: number, f: any) => s + Number(f.valor), 0);
  const aReceberFin = fins.filter((f: any) => f.tipo === "receita" && f.status === "pendente").reduce((s: number, f: any) => s + Number(f.valor), 0);
  const despesas = fins.filter((f: any) => f.tipo === "despesa" && f.status === "pago").reduce((s: number, f: any) => s + Number(f.valor), 0);

  const parcelas = parc.data ?? [];
  const aberto = parcelas.filter((p: any) => !p.pago).reduce((s: number, p: any) => s + Number(p.valor), 0);
  const atrasado = parcelas.filter((p: any) => !p.pago && p.vencimento && p.vencimento < hoje()).reduce((s: number, p: any) => s + Number(p.valor), 0);

  const estoqueBaixo = (est.data ?? []).filter((i: any) => i.quantidade <= i.minimo).map((i: any) => `${i.nome} (${i.quantidade}/${i.minimo})`);

  const orcs = orc.data ?? [];
  const orcPorStatus = orcs.reduce((acc: Record<string, number>, o: any) => { acc[o.status] = (acc[o.status] ?? 0) + 1; return acc; }, {});

  const financeiroDisponivel = !fin.error; // secretária recebe erro RLS aqui

  return JSON.stringify({
    data_de_hoje: hoje(),
    pacientes: { total: pacientes.length, ativos },
    agendamentos: ag.data ?? [],
    financeiro: financeiroDisponivel
      ? { recebido_pago: recebido, a_receber_pendente: aReceberFin, despesas_pagas: despesas }
      : "sem permissão para ver financeiro",
    contas_a_receber: { em_aberto: aberto, em_atraso: atrasado },
    estoque_baixo: estoqueBaixo,
    orcamentos_por_status: orcPorStatus,
  });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!aiConfigurado()) return NextResponse.json({ error: "IA não configurada." }, { status: 503 });

  const { messages } = await req.json().catch(() => ({ messages: [] }));
  const historico: AiMessage[] = Array.isArray(messages) ? messages.slice(-10) : [];
  if (historico.length === 0) return NextResponse.json({ error: "Envie a pergunta." }, { status: 400 });

  const contexto = await montarContexto(supabase);

  const prompt: AiMessage[] = [
    {
      role: "system",
      content:
        "Você é o assistente virtual de uma clínica odontológica, falando em português do Brasil. " +
        "Responda de forma curta, clara e útil, SEMPRE com base nos DADOS DA CLÍNICA fornecidos abaixo. " +
        "Se a informação não estiver nos dados, diga que não tem essa informação (não invente). " +
        "Valores em reais. Não dê diagnósticos clínicos.\n\nDADOS DA CLÍNICA (JSON):\n" + contexto,
    },
    ...historico,
  ];

  try {
    const result = await aiChat(prompt, { maxTokens: 500 });
    return NextResponse.json({ result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha na IA." }, { status: 502 });
  }
}
