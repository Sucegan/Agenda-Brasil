import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { publicSupabaseAnonKey, publicSupabaseUrl } from "@/lib/public-env";

export const supabase = createBrowserClient<Database>(publicSupabaseUrl, publicSupabaseAnonKey);
