export function register() {
  // Provider-neutral hook. Server errors are persisted by the API routes and
  // can later be forwarded to a dedicated observability vendor.
}

export async function onRequestError(
  error: Error & { digest?: string },
  request: { path: string; method: string },
  context: Record<string, unknown>,
) {
  const event = {
    message: error.message,
    digest: error.digest,
    path: request.path,
    method: request.method,
    context,
  };
  const admin = createAdminClient();
  if (admin) {
    await admin.from('telemetria_eventos').insert({
      tipo: 'erro_servidor',
      rota: request.path,
      mensagem: error.message,
      contexto: JSON.parse(JSON.stringify(event)) as Record<string, unknown>,
    });
  } else {
    console.error('[Agenda Brasil request error]', event);
  }
}
import { createAdminClient } from '@/lib/server/supabase-admin';
