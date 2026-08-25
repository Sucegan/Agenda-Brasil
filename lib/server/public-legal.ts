import { createClient } from '@supabase/supabase-js';
import type { Database, PublicLegalInformation } from '@/lib/database.types';
import { publicSupabaseAnonKey, publicSupabaseUrl } from '@/lib/public-env';

export async function getPublicLegalInformation(slug = 'agenda-brasil'): Promise<PublicLegalInformation | null> {
  try {
    const client = createClient<Database>(publicSupabaseUrl, publicSupabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await client.rpc('obter_informacoes_legais_barbearia', { p_slug: slug });
    return error ? null : data;
  } catch {
    return null;
  }
}
