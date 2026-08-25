import type { Notification } from '@/lib/database.types';
import { createAdminClient } from '@/lib/server/supabase-admin';

type NotificationPayload = {
  cliente_nome?: string;
  cliente_telefone?: string;
  barbeiro_nome?: string;
  servico_nome?: string;
  data?: string;
  horario?: string;
  status?: string;
  barbearia_nome?: string;
};

function messageFor(notification: Notification) {
  const payload = notification.payload as NotificationPayload;
  const when = payload.data && payload.horario
    ? `${payload.data.split('-').reverse().join('/')} às ${payload.horario.slice(0, 5)}`
    : 'em breve';
  const service = payload.servico_nome ?? 'seu atendimento';
  const barber = payload.barbeiro_nome ? ` com ${payload.barbeiro_nome}` : '';

  if (notification.tipo === 'confirmacao') return `Agendamento recebido: ${service}${barber}, ${when}.`;
  if (notification.tipo === 'lembrete_24h') return `Lembrete: ${service}${barber} está marcado para ${when}.`;
  if (notification.tipo === 'lembrete_2h') return `Seu horário de ${service}${barber} começa em aproximadamente 2 horas.`;
  if (notification.tipo === 'fila_espera') return `Um horário de ${service}${barber} ficou disponível em ${when}. Abra a Agenda Brasil para reservar.`;
  return `Seu agendamento de ${service}${barber} foi atualizado para ${payload.status ?? 'um novo status'}.`;
}

async function deliverEmail(notification: Notification, message: string) {
  const admin = createAdminClient();
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFICATION_EMAIL_FROM;
  if (!admin || !apiKey || !from || !notification.usuario_id) throw new Error('E-mail automático ainda não foi configurado.');

  const { data, error } = await admin.auth.admin.getUserById(notification.usuario_id);
  if (error || !data.user.email) throw new Error('Destinatário de e-mail não encontrado.');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [data.user.email],
      subject: (notification.tipo === 'confirmacao'
        ? `Agendamento recebido — ${(notification.payload as NotificationPayload).barbearia_nome ?? 'Agenda Brasil'}`
        : notification.tipo === 'fila_espera'
          ? 'Horário disponível — Agenda Brasil'
          : 'Atualização do agendamento — Agenda Brasil').replace(/[\r\n]+/g, ' '),
      text: `${message}\n\nConsulte os detalhes e o status diretamente no painel da Agenda Brasil.\n${process.env.NEXT_PUBLIC_APP_URL ?? 'https://agenda-brasil.vercel.app'}/dashboard`,
      ...(process.env.NOTIFICATION_REPLY_TO ? { reply_to: process.env.NOTIFICATION_REPLY_TO } : {}),
    }),
  });
  if (!response.ok) {
    const providerError = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(`Provedor de e-mail respondeu ${response.status}${providerError.message ? `: ${providerError.message}` : ''}.`);
  }
}

async function deliverWhatsapp(notification: Notification, message: string) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const rawPhone = String((notification.payload as NotificationPayload).cliente_telefone ?? '');
  const digits = rawPhone.replace(/\D/g, '');
  const recipient = digits.length <= 11 ? `55${digits}` : digits;
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME;
  const language = process.env.WHATSAPP_TEMPLATE_LANGUAGE ?? 'pt_BR';
  if (!token || !phoneNumberId || recipient.length < 12) throw new Error('WhatsApp automático ainda não foi configurado.');

  const payload = notification.payload as NotificationPayload;
  const messageBody = templateName ? {
    messaging_product: 'whatsapp',
    to: recipient,
    type: 'template',
    template: {
      name: templateName,
      language: { code: language },
      components: [{
        type: 'body',
        parameters: [
          { type: 'text', text: payload.cliente_nome ?? 'Cliente' },
          { type: 'text', text: payload.servico_nome ?? 'atendimento' },
          { type: 'text', text: payload.data?.split('-').reverse().join('/') ?? 'data a confirmar' },
          { type: 'text', text: payload.horario?.slice(0, 5) ?? 'horário a confirmar' },
        ],
      }],
    },
  } : { messaging_product: 'whatsapp', to: recipient, type: 'text', text: { preview_url: false, body: message } };

  const response = await fetch(`https://graph.facebook.com/v22.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(messageBody),
  });
  if (!response.ok) throw new Error(`Provedor de WhatsApp respondeu ${response.status}.`);
}

export async function deliverNotification(notification: Notification) {
  const message = messageFor(notification);
  if (notification.canal === 'email') return deliverEmail(notification, message);
  if (notification.canal === 'whatsapp') return deliverWhatsapp(notification, message);
  throw new Error('Canal não disponível na versão web.');
}
