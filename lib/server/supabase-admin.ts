import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;

  return createClient<Database>(url, serviceRoleKey, {
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
