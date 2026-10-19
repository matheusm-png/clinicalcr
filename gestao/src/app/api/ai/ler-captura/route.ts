import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aiConfigurado } from "@/lib/ai";
import { lerFichaCompleta } from "@/lib/ai/fichaCompleta";

// Lê com IA uma ficha que JÁ ESTÁ na fila do Storage ({clinica}/capturas/{pasta}/)
// e grava o resultado em `leitura.json` na mesma pasta. Assim a leitura acontece
// em segundo plano: quando a dentista abre a ficha pra conferir, ela já está lida.
// Chamado pelo celular logo após enviar e pela tela "Adicionar fichas" para os
// lotes ainda sem leitura. O corpo é só o nome da pasta — sem limite de upload.
// Dado de saúde do paciente: NÃO logamos o conteúdo extraído nem as imagens.
export const maxDuration = 60;

const ARQ_LEITURA = "leitura.json";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!aiConfigurado()) return NextResponse.json({ error: "IA não configurada." }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const pasta = String(body?.pasta ?? "");
  const forcar = !!body?.forcar;
  if (!/^[\w-]+$/.test(pasta)) return NextResponse.json({ error: "Pasta inválida." }, { status: 400 });

  // A RLS devolve só a clínica do usuário — e a policy do bucket exige a 1ª pasta = clínica.
  const { data: clinica } = await supabase.from("clinicas").select("id").limit(1).maybeSingle();
  if (!clinica?.id) return NextResponse.json({ error: "Clínica não encontrada." }, { status: 403 });
  const base = `${clinica.id}/capturas/${pasta}`;
  const bucket = supabase.storage.from("anexos");

  const { data: arquivos, error: errList } = await bucket.list(base);
  if (errList) return NextResponse.json({ error: "Não foi possível abrir a ficha." }, { status: 500 });
  const nomes = (arquivos ?? []).filter((a) => a.id).map((a) => a.name);
  if (!forcar && nomes.includes(ARQ_LEITURA)) {
    return NextResponse.json({ ok: true, jaLida: true });
  }
  const imagens = nomes.filter((n) => /\.(jpe?g|png|webp)$/i.test(n)).sort();
  if (!imagens.length) return NextResponse.json({ error: "Ficha sem fotos." }, { status: 404 });

  // O bucket não tem policy de UPDATE: para reescrever (nova tentativa), apaga e insere.
  const gravar = async (conteudo: unknown) => {
    if (nomes.includes(ARQ_LEITURA)) await bucket.remove([`${base}/${ARQ_LEITURA}`]);
    return bucket.upload(`${base}/${ARQ_LEITURA}`, new Blob([JSON.stringify(conteudo)], { type: "application/json" }), {
      contentType: "application/json",
    });
  };

  try {
    const dataUrls: string[] = [];
    for (const nome of imagens.slice(0, 8)) {
      const { data: blob, error } = await bucket.download(`${base}/${nome}`);
      if (error || !blob) throw new Error("Não foi possível baixar as fotos da ficha.");
      const b64 = Buffer.from(await blob.arrayBuffer()).toString("base64");
      dataUrls.push(`data:${blob.type || "image/jpeg"};base64,${b64}`);
    }
    const lida = await lerFichaCompleta(dataUrls);
    await gravar({ ...lida, lidaEm: new Date().toISOString() });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao ler a ficha.";
    // Grava o erro para a tela mostrar "não deu pra ler — tentar de novo" em vez de ficar "lendo…" pra sempre.
    await gravar({ erro: msg, lidaEm: new Date().toISOString() });
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
