import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthPortal } from '@/components/auth-portal';

export const metadata: Metadata = {
  title: 'Entrar | Agenda Brasil',
  description: 'Acesse sua conta da Agenda Brasil com segurança.',
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ motivo?: string; tipo?: string; convite?: string }> }) {
  const params = await searchParams;
  if (params.tipo === 'proprietario') redirect('/cadastro/estabelecimento');
  if (params.tipo === 'barbeiro') redirect(`/cadastro/profissional${params.convite ? `?convite=${encodeURIComponent(params.convite)}` : ''}`);
  return <AuthPortal mode="login" sessionExpired={params.motivo === 'sessao-expirada'} />;
}
