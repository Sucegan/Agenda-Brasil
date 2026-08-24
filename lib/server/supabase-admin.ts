import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { publicSupabaseUrl } from '@/lib/public-env';

export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return null;

  return createClient<Database>(publicSupabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function getAuthenticatedUser(request: Request) {
  const admin = createAdminClient();
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!admin || !token) return { admin, user: null };
  const { data, error } = await admin.auth.getUser(token);
  return { admin, user: error ? null : data.user };
}
