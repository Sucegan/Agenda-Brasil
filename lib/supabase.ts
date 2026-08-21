import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("As variáveis públicas do Supabase não foram configuradas.");
}

export const supabase = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
