import webpush from 'web-push';
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
      subject: notification.tipo === 'fila_espera' ? 'Horário disponível na Agenda Brasil' : 'Atualização do seu agendamento',
      text: `${message}\n\nAcesse a Agenda Brasil para confirmar, cancelar ou consultar os detalhes.`,
    }),
  });
  if (!response.ok) throw new Error(`Provedor de e-mail respondeu ${response.status}.`);
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

async function deliverPush(notification: Notification, message: string) {
  const admin = createAdminClient();
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? 'mailto:suporte@agenda-brasil.app';
  if (!admin || !publicKey || !privateKey || !notification.usuario_id) throw new Error('Notificações push ainda não foram configuradas.');

  webpush.setVapidDetails(subject, publicKey, privateKey);
  const { data, error } = await admin.from('push_subscriptions').select('*').eq('usuario_id', notification.usuario_id);
  if (error || !data?.length) throw new Error('O cliente ainda não ativou notificações neste aparelho.');

  const payload = JSON.stringify({
    title: notification.tipo === 'fila_espera' ? 'Horário disponível' : 'Agenda Brasil',
    body: message,
    url: '/dashboard',
    tag: `agenda-${notification.agendamento_id ?? notification.id}`,
  });
  const results = await Promise.allSettled(data.map((subscription) => webpush.sendNotification({
    endpoint: subscription.endpoint,
    keys: { p256dh: subscription.p256dh, auth: subscription.auth_key },
  }, payload)));
  if (results.every((result) => result.status === 'rejected')) throw new Error('Nenhum aparelho aceitou a notificação.');
}

export async function deliverNotification(notification: Notification) {
  const message = messageFor(notification);
  if (notification.canal === 'email') return deliverEmail(notification, message);
  if (notification.canal === 'whatsapp') return deliverWhatsapp(notification, message);
  return deliverPush(notification, message);
}
