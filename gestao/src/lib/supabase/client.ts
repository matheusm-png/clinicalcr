import { createBrowserClient } from "@supabase/ssr";

// True quando as chaves do Supabase estão configuradas no .env.local.
// Enquanto não estiverem, o app roda sem backend (sem login/sem dados).
export const isSupabaseConfigured = () =>
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Cliente Supabase para uso no browser (client components).
// As chaves NEXT_PUBLIC_* são expostas ao cliente — use SEMPRE a anon key,
// nunca a service_role. A segurança real é garantida por RLS no banco.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
