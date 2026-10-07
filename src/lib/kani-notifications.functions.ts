import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';

import type { Database } from '@/integrations/supabase/types';

type NotificationType = Database['public']['Enums']['notification_type'];
type NotificationClaim = {
  notification_id: string;
  notification_type: NotificationType;
  recipient_email: string;
  client_name: string;
  barber_name: string;
  service_name: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  dispatch_status: string;
  attempt: number;
};
type NotificationPayload = {
  notificationId: string;
  notificationType: NotificationType;
  recipientEmail: string;
  clientName: string;
  barberName: string;
  serviceName: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
};

type DispatchResult = {
  sent: boolean;
  status: 'SENT' | 'ALREADY_SENT' | 'IN_PROGRESS' | 'FAILED' | 'SKIPPED';
};

export const sendAppointmentNotification = createServerFn({ method: 'POST' })
  .validator((data: { appointmentId: string; claimToken: string }) => {
    if (!data?.appointmentId || !data?.claimToken) throw new Error('NOTIFICATION_INPUT_INVALID');
    return data;
  })
  .handler(async ({ data }): Promise<DispatchResult> => {
    let notificationId: string | undefined;
    try {
      const supabase = await createRequestSupabaseClient();
      const { data: claimed, error: claimError } = await supabase.rpc('claim_appointment_notification', {
        p_appointment_id: data.appointmentId,
        p_claim_token: data.claimToken,
      });
      if (claimError) throw claimError;

      const event = claimed?.[0] as NotificationClaim | undefined;
      if (!event) return { sent: false, status: 'SKIPPED' };
      notificationId = event.notification_id;
      if (event.dispatch_status === 'ALREADY_SENT') return { sent: true, status: 'ALREADY_SENT' };
      if (event.dispatch_status === 'IN_PROGRESS') return { sent: false, status: 'IN_PROGRESS' };

      const apiKey = process.env['RESEND_API_KEY'];
      const fromEmail = process.env['RESEND_FROM_EMAIL'];
      if (!apiKey || !fromEmail) throw new Error('RESEND_CONFIGURATION_MISSING');

      const payload: NotificationPayload = {
        notificationId: event.notification_id,
        notificationType: event.notification_type,
        recipientEmail: event.recipient_email,
        clientName: event.client_name,
        barberName: event.barber_name,
        serviceName: event.service_name,
        bookingDate: event.booking_date,
        startTime: event.start_time,
        endTime: event.end_time,
      };
      const email = buildEmail(payload);
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': event.notification_id,
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [event.recipient_email],
          subject: email.subject,
          html: email.html,
          text: email.text,
        }),
      });
      const result = await response.json().catch(() => null) as { id?: string; message?: string } | null;
      if (!response.ok) {
        throw new Error(`RESEND_${response.status}: ${result?.message ?? 'SEND_FAILED'}`);
      }

      const { error: completeError } = await supabase.rpc('complete_appointment_notification', {
        p_notification_id: event.notification_id,
        p_claim_token: data.claimToken,
        p_provider_message_id: result?.id ?? '',
      });
      if (completeError) throw completeError;
      return { sent: true, status: 'SENT' };
    } catch (error) {
      const safeMessage = safeErrorMessage(error);
      console.error(`[KANI notification] ${safeMessage}`);
      if (notificationId) {
        try {
          const supabase = await createRequestSupabaseClient();
          await supabase.rpc('fail_appointment_notification', {
            p_notification_id: notificationId,
            p_claim_token: data.claimToken,
            p_error: safeMessage,
          });
        } catch (recordError) {
          console.error(`[KANI notification] failed to record failure: ${safeErrorMessage(recordError)}`);
        }
      }
      // El outbox registra el fallo; nunca se propaga a la transacción de reserva o estado.
      return { sent: false, status: 'FAILED' };
    }
  });

async function createRequestSupabaseClient() {
  const [{ createClient }, request] = await Promise.all([
    import('@supabase/supabase-js'),
    Promise.resolve(getRequest()),
  ]);
  const supabaseUrl = process.env['VITE_SUPABASE_URL'] ?? process.env['SUPABASE_URL'];
  const supabaseKey = process.env['VITE_SUPABASE_ANON_KEY'] ?? process.env['SUPABASE_ANON_KEY'] ?? process.env['SUPABASE_PUBLISHABLE_KEY'];
  if (!supabaseUrl || !supabaseKey) throw new Error('SUPABASE_SERVER_CONFIGURATION_MISSING');

  const authorization = request?.headers.get('authorization');
  return createClient<Database>(supabaseUrl, supabaseKey, {
    global: {
      fetch: (input, init) => {
        const headers = new Headers(
          typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
        );
        if (init?.headers) new Headers(init.headers).forEach((value, key) => headers.set(key, value));
        headers.set('apikey', supabaseKey);
        if (authorization) headers.set('Authorization', authorization);
        return fetch(input, { ...init, headers });
      },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

function buildEmail(payload: NotificationPayload) {
  const date = new Date(`${payload.bookingDate}T12:00:00`).toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const time = `${payload.startTime.slice(0, 5)} a ${payload.endTime.slice(0, 5)} hs`;
  const safe = {
    clientName: escapeHtml(payload.clientName),
    barberName: escapeHtml(payload.barberName),
    serviceName: escapeHtml(payload.serviceName),
    date: escapeHtml(date),
    time: escapeHtml(time),
    status: '',
  };
  const copy = {
    NEW_REQUEST: {
      subject: 'Recibimos tu solicitud en KANI',
      title: 'Turno pendiente de confirmación',
      intro: 'Recibimos tu solicitud. El equipo de KANI la revisará y te avisaremos cuando quede confirmada.',
      status: 'PENDIENTE',
    },
    CONFIRMED: {
      subject: 'Tu turno en KANI está confirmado',
      title: 'Tu turno está confirmado',
      intro: 'Ya está todo listo. Te esperamos en KANI para tu próximo momento.',
      status: 'CONFIRMADO',
    },
    CANCELLED: {
      subject: 'Actualización de tu turno en KANI',
      title: 'Tu turno fue cancelado',
      intro: 'El turno indicado a continuación fue cancelado. Si querés, podés solicitar uno nuevo desde nuestra web.',
      status: 'CANCELADO',
    },
  }[payload.notificationType];
  safe.status = copy.status;
  const subject = `${copy.subject} · ${payload.bookingDate}`;
  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#f4f1eb;color:#1c1c1c;font-family:Arial,sans-serif"><div style="max-width:560px;margin:0 auto;padding:36px 20px"><div style="background:#161616;padding:22px 24px;color:#f4f1eb;letter-spacing:.18em;font-weight:700;font-size:18px">KANI <span style="color:#c79b5b">/</span> BARBER STUDIO</div><main style="background:#fff;padding:34px 24px"><p style="margin:0 0 12px;color:#a37b43;font-size:11px;letter-spacing:.16em;font-weight:700">${safe.status}</p><h1 style="margin:0;font-size:28px;line-height:1.1">${copy.title}</h1><p style="color:#6d6d6d;line-height:1.6;margin:18px 0 28px">Hola ${safe.clientName},<br>${copy.intro}</p><div style="border-top:1px solid #e5e0d8;border-bottom:1px solid #e5e0d8;padding:18px 0"><p style="margin:0 0 10px"><strong>Servicio:</strong> ${safe.serviceName}</p><p style="margin:0 0 10px"><strong>Barbero:</strong> ${safe.barberName}</p><p style="margin:0 0 10px"><strong>Fecha:</strong> ${safe.date}</p><p style="margin:0"><strong>Horario:</strong> ${safe.time}</p></div><p style="color:#6d6d6d;line-height:1.6;margin:26px 0 0">San Isidro Labrador 7<br>Martínez, Provincia de Buenos Aires</p></main><p style="color:#8b8b8b;font-size:12px;line-height:1.5;text-align:center;margin:18px 8px">Este mensaje fue enviado automáticamente por KANI Barber Studio.</p></div></body></html>`;
  const text = `${copy.title}\n\nHola ${payload.clientName},\n${copy.intro}\n\nServicio: ${payload.serviceName}\nBarbero: ${payload.barberName}\nFecha: ${date}\nHorario: ${time}\n\nKANI Barber Studio\nSan Isidro Labrador 7, Martínez, Provincia de Buenos Aires`;
  return { subject, html, text };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character] ?? character);
}

function safeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/Bearer\s+[^\s]+/gi, 'Bearer [redacted]').slice(0, 500);
}
