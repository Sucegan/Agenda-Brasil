import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/server/supabase-admin';

export const dynamic = 'force-dynamic';

export async function DELETE(request: Request) {
  const { admin, user } = await getAuthenticatedUser(request);
  if (!admin) return NextResponse.json({ error: 'Exclusão imediata ainda não foi configurada.' }, { status: 503 });
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return NextResponse.json({ error: 'Não foi possível excluir a conta.' }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
