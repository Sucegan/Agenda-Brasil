import type { Metadata } from 'next';
import { AuthPortal } from '@/components/auth-portal';

export const metadata: Metadata = { title: 'Cadastro de estabelecimento | Agenda Brasil', description: 'Comece seu teste e configure sua agenda, equipe, serviços e pagamentos.' };

export default function BusinessSignupPage() {
  return <AuthPortal mode="proprietario" />;
}
