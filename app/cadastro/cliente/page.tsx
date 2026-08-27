import type { Metadata } from 'next';
import { AuthPortal } from '@/components/auth-portal';

export const metadata: Metadata = { title: 'Cadastro de cliente | Agenda Brasil', description: 'Crie sua conta gratuita de cliente para agendar e acompanhar seus horários.' };

export default function ClientSignupPage() {
  return <AuthPortal mode="cliente" />;
}
