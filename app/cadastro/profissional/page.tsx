import type { Metadata } from 'next';
import { AuthPortal } from '@/components/auth-portal';

export const metadata: Metadata = { title: 'Convite de profissional | Agenda Brasil', description: 'Aceite o convite privado para fazer parte de uma equipe.', robots: { index: false, follow: false } };

export default async function ProfessionalSignupPage({ searchParams }: { searchParams: Promise<{ convite?: string }> }) {
  const params = await searchParams;
  return <AuthPortal mode="barbeiro" inviteToken={params.convite ?? null} />;
}
