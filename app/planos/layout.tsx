import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Planos para estabelecimentos | Agenda Brasil',
  description: 'Agenda online, gestão de equipe, pagamentos e financeiro para barbearias e estabelecimentos. Teste grátis por 14 dias.',
  alternates: { canonical: '/planos' },
};

export default function PlansLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
