import type { Metadata } from 'next';
import { BusinessContact } from '@/components/business-contact';

export const metadata: Metadata = { title: 'Contratar Agenda Brasil | Sucegan Tech', description: 'Fale com a Sucegan Tech para cadastrar e configurar seu estabelecimento.' };

export default function BusinessSignupPage() {
  return <BusinessContact />;
}
