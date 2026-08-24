import type { Metadata } from 'next';
import Link from 'next/link';
import { getPublicLegalInformation } from '@/lib/server/public-legal';
import { SiteRights } from '@/components/site-rights';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Política de Privacidade | Agenda Brasil', description: 'Como a Agenda Brasil trata e protege dados pessoais.' };

export default async function PrivacyPage() {
  const legal = await getPublicLegalInformation();
  const controller = legal?.responsavel_legal || legal?.nome || 'estabelecimento responsável pela agenda';
  const contact = legal?.email_privacidade || legal?.telefone || 'o canal de contato informado pelo estabelecimento';
  const retention = legal?.prazo_retencao_meses ?? 24;

  return <main className="app-screen safe-page-bottom bg-zinc-950 p-4 text-zinc-100 sm:p-8"><article className="mx-auto max-w-3xl rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-xl sm:p-9"><p className="text-xs font-bold uppercase tracking-widest text-emerald-400">Agenda Brasil · LGPD</p><h1 className="mt-2 text-3xl font-black">Política de privacidade</h1><p className="mt-2 text-sm text-zinc-500">Última atualização: 24 de agosto de 2026</p><div className="mt-7 space-y-6 text-sm leading-7 text-zinc-300">
    <section><h2 className="text-lg font-bold text-white">1. Quem controla os dados</h2><p>O controlador dos dados do atendimento é <b className="text-zinc-100">{controller}</b>{legal?.documento_legal ? `, documento ${legal.documento_legal}` : ''}. A Sucegan Tech é titular da plataforma Agenda Brasil e fornece a tecnologia de agendamento utilizada pelo estabelecimento.</p></section>
    <section><h2 className="text-lg font-bold text-white">2. Dados tratados</h2><p>Tratamos nome, e-mail, telefone, dados de autenticação, preferências de comunicação, horários, serviços, pagamentos informados, faltas, cancelamentos e registros técnicos mínimos de segurança e desempenho. Não solicitamos dados sensíveis para realizar um agendamento.</p></section>
    <section><h2 className="text-lg font-bold text-white">3. Finalidades e bases legais</h2><p>Usamos os dados para criar e administrar a conta, executar o agendamento solicitado, enviar avisos escolhidos pelo usuário, cumprir obrigações legais, prevenir fraude, proteger o serviço e melhorar sua confiabilidade. Comunicações promocionais dependem de opção separada e podem ser desativadas.</p></section>
    <section><h2 className="text-lg font-bold text-white">4. Compartilhamento e operadores</h2><p>Os dados são acessados somente pelo estabelecimento e profissionais envolvidos no atendimento e por fornecedores necessários de banco de dados, autenticação, hospedagem, e-mail, WhatsApp, notificações ou pagamento, quando esses canais estiverem ativados. Não comercializamos dados pessoais.</p></section>
    <section><h2 className="text-lg font-bold text-white">5. Retenção e descarte</h2><p>Registros operacionais de atendimento podem ser mantidos por até <b className="text-zinc-100">{retention} meses</b>, salvo obrigação legal, exercício regular de direitos ou solicitação válida de eliminação. Intenções não concluídas expiram em 30 minutos; telemetria técnica é eliminada em até 90 dias.</p></section>
    <section><h2 className="text-lg font-bold text-white">6. Segurança</h2><p>Adotamos conexão criptografada, isolamento de dados por usuário, funções de banco com privilégios mínimos, fila de mensagens com trava contra duplicidade, limitação de abuso e monitoramento técnico. Nenhum sistema é infalível; incidentes relevantes serão tratados conforme a legislação aplicável.</p></section>
    <section><h2 className="text-lg font-bold text-white">7. Seus direitos</h2><p>Nos termos da LGPD, você pode pedir confirmação e acesso, correção, portabilidade quando aplicável, informação sobre compartilhamentos, revisão de consentimentos, oposição e eliminação de dados tratados com consentimento. A conta também oferece exportação e solicitação de exclusão.</p></section>
    <section><h2 className="text-lg font-bold text-white">8. Cookies e armazenamento local</h2><p>Usamos somente o armazenamento necessário para manter a sessão, proteger o acesso e lembrar preferências técnicas. Não usamos publicidade comportamental neste serviço.</p></section>
    <section><h2 className="text-lg font-bold text-white">9. Contato</h2><p>Solicitações de privacidade devem ser enviadas por <b className="text-zinc-100">{contact}</b>{legal?.endereco ? ` ou ao endereço ${legal.endereco}` : ''}. Poderemos pedir confirmação de identidade para proteger a conta.</p></section>
  </div><div className="mt-8 flex flex-wrap gap-3"><Link href="/" className="rounded-xl border border-zinc-700 px-4 py-3 text-sm font-bold">Voltar</Link><Link href="/termos" className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold">Ver termos</Link><Link href="/agendar" className="rounded-xl border border-emerald-500/30 px-4 py-3 text-sm font-bold text-emerald-300">Agendar</Link></div><SiteRights className="mt-8 border-t border-zinc-800 pt-5" /></article></main>;
}
