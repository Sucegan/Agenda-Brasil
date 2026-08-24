import type { Metadata } from 'next';
import Link from 'next/link';
import { getPublicLegalInformation } from '@/lib/server/public-legal';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Termos de Uso | Agenda Brasil', description: 'Regras para uso da Agenda Brasil e dos agendamentos online.' };

export default async function TermsPage() {
  const legal = await getPublicLegalInformation();
  const business = legal?.nome || 'estabelecimento responsável';
  const contact = legal?.email_privacidade || legal?.telefone || 'canal informado pelo estabelecimento';

  return <main className="app-screen safe-page-bottom bg-zinc-950 p-4 text-zinc-100 sm:p-8"><article className="mx-auto max-w-3xl rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-xl sm:p-9"><p className="text-xs font-bold uppercase tracking-widest text-emerald-400">Agenda Brasil</p><h1 className="mt-2 text-3xl font-black">Termos de uso</h1><p className="mt-2 text-sm text-zinc-500">Última atualização: 24 de agosto de 2026</p><div className="mt-7 space-y-6 text-sm leading-7 text-zinc-300">
    <section><h2 className="text-lg font-bold text-white">1. Aceitação</h2><p>Ao criar uma conta ou solicitar um horário, você aceita estes termos e a política de privacidade. Se não concordar, não conclua o cadastro ou o agendamento.</p></section>
    <section><h2 className="text-lg font-bold text-white">2. Finalidade do serviço</h2><p>A Agenda Brasil facilita reservas entre clientes e <b className="text-zinc-100">{business}</b>. O atendimento, a qualidade do serviço presencial, os preços e as regras comerciais são de responsabilidade do estabelecimento.</p></section>
    <section><h2 className="text-lg font-bold text-white">3. Conta e uso responsável</h2><p>Informe dados verdadeiros, mantenha o acesso ao seu e-mail protegido e não tente contornar limites, acessar dados de terceiros, interferir no funcionamento ou usar o serviço para finalidade ilícita. Podemos restringir atividades que coloquem a plataforma ou outras pessoas em risco.</p></section>
    <section><h2 className="text-lg font-bold text-white">4. Agendamentos</h2><p>A reserva só é confirmada quando o sistema exibe a conclusão. A disponibilidade pode mudar até esse instante. O cliente deve verificar profissional, serviço, data, horário, preço e duração antes de confirmar.</p></section>
    <section><h2 className="text-lg font-bold text-white">5. Cancelamentos, atrasos e faltas</h2><p>A antecedência mínima configurada aparece no painel. Cancelamentos tardios ficam registrados; faltas repetidas podem impedir temporariamente novos agendamentos. O estabelecimento deve aplicar suas regras de forma transparente e compatível com a legislação do consumidor.</p></section>
    <section><h2 className="text-lg font-bold text-white">6. Sinal e pagamentos</h2><p>Quando houver sinal, percentual, valor e instruções são exibidos no fluxo. Enquanto não houver integração automática habilitada, a marcação de pagamento depende de confirmação do profissional. Não envie valores para dados diferentes dos apresentados na conta oficial do estabelecimento.</p></section>
    <section><h2 className="text-lg font-bold text-white">7. Comunicações</h2><p>Mensagens transacionais podem informar confirmação, lembrete, alteração ou vaga na fila de espera. Cada usuário pode escolher canais disponíveis. Marketing depende de consentimento separado.</p></section>
    <section><h2 className="text-lg font-bold text-white">8. Disponibilidade e alterações</h2><p>Buscamos manter o serviço seguro e disponível, mas internet, manutenção e fornecedores externos podem causar interrupções. Funcionalidades e termos podem evoluir; mudanças relevantes terão data de atualização e, quando necessário, novo aceite.</p></section>
    <section><h2 className="text-lg font-bold text-white">9. Contato e legislação</h2><p>Dúvidas ou reclamações podem ser enviadas pelo <b className="text-zinc-100">{contact}</b>. Aplicam-se as leis brasileiras, inclusive o Código de Defesa do Consumidor e a LGPD, quando pertinentes.</p></section>
  </div><div className="mt-8 flex flex-wrap gap-3"><Link href="/" className="rounded-xl border border-zinc-700 px-4 py-3 text-sm font-bold">Voltar</Link><Link href="/privacidade" className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold">Ver privacidade</Link><Link href="/agendar" className="rounded-xl border border-emerald-500/30 px-4 py-3 text-sm font-bold text-emerald-300">Agendar</Link></div></article></main>;
}
