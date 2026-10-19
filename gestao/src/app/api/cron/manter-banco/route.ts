import { NextResponse } from "next/server";
import { createAdminClient, adminConfigurado } from "@/lib/supabase/admin";

// Cron diário da Vercel (vercel.json → "crons"). O Supabase do plano gratuito
// PAUSA o projeto depois de ~7 dias sem uso — e aí o app para de salvar sem
// aviso (aconteceu em out/2026). Uma consulta leve por dia mantém o banco ativo.
// A Vercel manda "Authorization: Bearer $CRON_SECRET" quando a variável existe.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const segredo = process.env.CRON_SECRET;
  if (segredo && req.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  if (!adminConfigurado()) return NextResponse.json({ error: "Sem chave do Supabase." }, { status: 503 });

  const { error } = await createAdminClient().from("clinicas").select("id").limit(1);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
  return NextResponse.json({ ok: true, em: new Date().toISOString() });
}
