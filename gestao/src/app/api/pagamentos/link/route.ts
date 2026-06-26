import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { criarLink, infinitepayConfigurado } from "@/lib/pagamentos/infinitepay";

// Gera um link de pagamento InfinitePay para uma parcela. Protegida por login.
// A confirmação NÃO acontece aqui — quem dá baixa é o webhook (revalidado).
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  let body: { parcelaId?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400 }); }
  if (!body.parcelaId) return NextResponse.json({ error: "Informe a parcela." }, { status: 400 });

  // Carrega parcela (RLS garante que é da clínica do usuário).
  const { data: parcela } = await supabase
    .from("parcelas")
    .select("id, valor, numero, pago, conta_id")
    .eq("id", body.parcelaId)
    .maybeSingle();
  if (!parcela) return NextResponse.json({ error: "Parcela não encontrada." }, { status: 404 });
  if (parcela.pago) return NextResponse.json({ error: "Parcela já está paga." }, { status: 409 });

  // Dados da conta (descrição) e do paciente (nome/telefone p/ o checkout).
  const { data: conta } = await supabase
    .from("contas_receber")
    .select("descricao, paciente_id")
    .eq("id", parcela.conta_id)
    .maybeSingle();
  let pacienteNome = "", pacienteTel = "";
  if (conta?.paciente_id) {
    const { data: pac } = await supabase.from("pacientes").select("nome, telefone").eq("id", conta.paciente_id).maybeSingle();
    pacienteNome = pac?.nome ?? "";
    pacienteTel = pac?.telefone ?? "";
  }

  // Handle (InfiniteTag) da clínica.
  const { data: clinica } = await supabase.from("clinicas").select("infinitepay_handle, nome").limit(1).maybeSingle();
  const handle = clinica?.infinitepay_handle ?? "";

  const origin = new URL(req.url).origin;
  const orderNsu = String(parcela.id);
  const descricao = `${conta?.descricao ?? "Cobrança"} — parcela ${parcela.numero}`;

  try {
    const { url, mock } = await criarLink({
      handle,
      orderNsu,
      redirectUrl: `${origin}/admin/receber`,
      webhookUrl: `${origin}/api/pagamentos/webhook`,
      items: [{ quantity: 1, price: Math.round(Number(parcela.valor) * 100), description: descricao.slice(0, 120) }],
      customer: pacienteNome ? { name: pacienteNome, phone_number: pacienteTel || undefined } : undefined,
    });

    // Guarda o link e o order_nsu na parcela (p/ o webhook localizar).
    await supabase.from("parcelas").update({ pagto_link: url, pagto_order_nsu: orderNsu }).eq("id", parcela.id);

    return NextResponse.json({ url, mock, configurado: infinitepayConfigurado(handle) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha ao gerar link." }, { status: 502 });
  }
}
