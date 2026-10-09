import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import type { Database } from "@/integrations/supabase/types";

type NotificationType = Database["public"]["Enums"]["notification_type"];
type NotificationClaim = {
  notification_id: string;
  notification_type: NotificationType;
  recipient_email: string | null;
  client_name: string;
  barber_name: string;
  service_name: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  client_notes: string | null;
  service_price_ars: number | null;
  service_duration_minutes: number | null;
  down_payment_ars: number | null;
  transfer_alias: string | null;
  transfer_cuit: string | null;
  transfer_holder_name: string | null;
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
  clientNotes: string | null;
  servicePriceArs: number | null;
  serviceDurationMinutes: number | null;
  downPaymentArs: number | null;
  transferAlias: string | null;
  transferCuit: string | null;
  transferHolderName: string | null;
};

type DispatchResult = {
  sent: boolean;
  status: "SENT" | "ALREADY_SENT" | "IN_PROGRESS" | "FAILED" | "SKIPPED";
};

export const sendAppointmentNotification = createServerFn({ method: "POST" })
  .validator((data: { appointmentId: string; claimToken: string }) => {
    if (!data?.appointmentId || !data?.claimToken) throw new Error("NOTIFICATION_INPUT_INVALID");
    return data;
  })
  .handler(async ({ data }): Promise<DispatchResult> => {
    let notificationId: string | undefined;
    try {
      const supabase = await createRequestSupabaseClient();
      const { data: claimed, error: claimError } = await supabase.rpc(
        "claim_appointment_notification",
        {
          p_appointment_id: data.appointmentId,
          p_claim_token: data.claimToken,
        },
      );
      if (claimError) throw claimError;

      const event = claimed?.[0] as NotificationClaim | undefined;
      if (!event) return { sent: false, status: "SKIPPED" };
      notificationId = event.notification_id;
      if (event.dispatch_status === "ALREADY_SENT") return { sent: true, status: "ALREADY_SENT" };
      if (event.dispatch_status === "IN_PROGRESS") return { sent: false, status: "IN_PROGRESS" };
      if (!event.recipient_email) throw new Error("NOTIFICATION_RECIPIENT_MISSING");

      const apiKey = process.env["RESEND_API_KEY"];
      const fromEmail = process.env["RESEND_FROM_EMAIL"];
      if (!apiKey || !fromEmail) throw new Error("RESEND_CONFIGURATION_MISSING");

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
        clientNotes: event.client_notes,
        servicePriceArs: event.service_price_ars,
        serviceDurationMinutes: event.service_duration_minutes,
        downPaymentArs: event.down_payment_ars,
        transferAlias: event.transfer_alias,
        transferCuit: event.transfer_cuit,
        transferHolderName: event.transfer_holder_name,
      };
      const email = buildEmail(payload);
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": event.notification_id,
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [event.recipient_email],
          subject: email.subject,
          html: email.html,
          text: email.text,
        }),
      });
      const result = (await response.json().catch(() => null)) as {
        id?: string;
        message?: string;
      } | null;
      if (!response.ok) {
        throw new Error(`RESEND_${response.status}: ${result?.message ?? "SEND_FAILED"}`);
      }

      const { error: completeError } = await supabase.rpc("complete_appointment_notification", {
        p_notification_id: event.notification_id,
        p_claim_token: data.claimToken,
        p_provider_message_id: result?.id ?? "",
      });
      if (completeError) throw completeError;
      return { sent: true, status: "SENT" };
    } catch (error) {
      const safeMessage = safeErrorMessage(error);
      console.error(`[KANI notification] ${safeMessage}`);
      if (notificationId) {
        try {
          const supabase = await createRequestSupabaseClient();
          const { error: recordError } = await supabase.rpc("fail_appointment_notification", {
            p_notification_id: notificationId,
            p_claim_token: data.claimToken,
            p_error: safeMessage,
          });
          if (recordError) throw recordError;
        } catch (recordError) {
          console.error(
            `[KANI notification] failed to record failure: ${safeErrorMessage(recordError)}`,
          );
        }
      }
      // El outbox registra el fallo; nunca se propaga a la transacción de reserva o estado.
      return { sent: false, status: "FAILED" };
    }
  });

async function createRequestSupabaseClient() {
  const [{ createClient }, request] = await Promise.all([
    import("@supabase/supabase-js"),
    Promise.resolve(getRequest()),
  ]);
  const supabaseUrl = process.env["VITE_SUPABASE_URL"] ?? process.env["SUPABASE_URL"];
  const supabaseKey =
    process.env["VITE_SUPABASE_ANON_KEY"] ??
    process.env["SUPABASE_ANON_KEY"] ??
    process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!supabaseUrl || !supabaseKey) throw new Error("SUPABASE_SERVER_CONFIGURATION_MISSING");

  const authorization = request?.headers.get("authorization");
  return createClient<Database>(supabaseUrl, supabaseKey, {
    global: {
      fetch: (input, init) => {
        const headers = new Headers(
          typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
        );
        if (init?.headers)
          new Headers(init.headers).forEach((value, key) => headers.set(key, value));
        headers.set("apikey", supabaseKey);
        if (authorization) headers.set("Authorization", authorization);
        return fetch(input, { ...init, headers });
      },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

function buildEmail(payload: NotificationPayload) {
  const date = new Date(`${payload.bookingDate}T12:00:00`).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const time = `${payload.startTime.slice(0, 5)} a ${payload.endTime.slice(0, 5)} hs`;
  const isNewRequest = payload.notificationType === "NEW_REQUEST";
  if (isNewRequest) return buildNewRequestEmail(payload, date, time);

  const safe = {
    clientName: escapeHtml(payload.clientName),
    barberName: escapeHtml(payload.barberName),
    serviceName: escapeHtml(payload.serviceName),
    date: escapeHtml(date),
    time: escapeHtml(time),
  };
  const copy =
    payload.notificationType === "CONFIRMED"
      ? {
          subject: "Tu turno en Kani Barber Studio está confirmado",
          title: "Tu turno está confirmado",
          intro: "Ya está todo listo. Te esperamos en Kani Barber Studio para tu próximo momento.",
          status: "CONFIRMADO",
        }
      : {
          subject: "Actualización de tu turno en Kani Barber Studio",
          title: "Tu turno fue cancelado",
          intro:
            "El turno indicado a continuación fue cancelado. Si querés, podés solicitar uno nuevo desde nuestra web.",
          status: "CANCELADO",
        };
  const subject = `${copy.subject} · ${payload.bookingDate}`;
  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#f4f1eb;color:#1c1c1c;font-family:Arial,sans-serif"><div style="max-width:560px;margin:0 auto;padding:36px 20px"><div style="background:#161616;padding:22px 24px;color:#f4f1eb;letter-spacing:.18em;font-weight:700;font-size:18px">Kani Barber Studio</div><main style="background:#fff;padding:34px 24px"><p style="margin:0 0 12px;color:#a37b43;font-size:11px;letter-spacing:.16em;font-weight:700">${copy.status}</p><h1 style="margin:0;font-size:28px;line-height:1.1">${copy.title}</h1><p style="color:#6d6d6d;line-height:1.6;margin:18px 0 28px">Hola ${safe.clientName},<br>${copy.intro}</p><div style="border-top:1px solid #e5e0d8;border-bottom:1px solid #e5e0d8;padding:18px 0"><p style="margin:0 0 10px"><strong>Servicio:</strong> ${safe.serviceName}</p><p style="margin:0 0 10px"><strong>Barbero:</strong> ${safe.barberName}</p><p style="margin:0 0 10px"><strong>Fecha:</strong> ${safe.date}</p><p style="margin:0"><strong>Horario:</strong> ${safe.time}</p></div><p style="color:#6d6d6d;line-height:1.6;margin:26px 0 0">San Isidro Labrador 7<br>Martínez, Provincia de Buenos Aires</p></main><p style="color:#8b8b8b;font-size:12px;line-height:1.5;text-align:center;margin:18px 8px">Este mensaje fue enviado automáticamente por Kani Barber Studio.</p></div></body></html>`;
  const text = `${copy.title}\n\nHola ${payload.clientName},\n${copy.intro}\n\nServicio: ${payload.serviceName}\nBarbero: ${payload.barberName}\nFecha: ${date}\nHorario: ${time}\n\nKani Barber Studio\nSan Isidro Labrador 7, Martínez, Provincia de Buenos Aires`;
  return { subject, html, text };
}

function buildNewRequestEmail(payload: NotificationPayload, date: string, time: string) {
  if (
    !payload.servicePriceArs ||
    !payload.serviceDurationMinutes ||
    !payload.downPaymentArs ||
    !payload.transferAlias ||
    !payload.transferCuit ||
    !payload.transferHolderName
  ) {
    throw new Error("TRANSFER_DETAILS_INCOMPLETE");
  }
  const safe = {
    clientName: escapeHtml(payload.clientName),
    barberName: escapeHtml(payload.barberName),
    serviceName: escapeHtml(payload.serviceName),
    date: escapeHtml(date),
    time: escapeHtml(time),
    servicePrice: escapeHtml(formatArs(payload.servicePriceArs)),
    downPayment: escapeHtml(formatArs(payload.downPaymentArs)),
    remainingPayment: escapeHtml(
      formatArs(Math.max(0, payload.servicePriceArs - payload.downPaymentArs)),
    ),
    transferAlias: escapeHtml(payload.transferAlias),
    transferCuit: escapeHtml(payload.transferCuit),
    transferHolderName: escapeHtml(payload.transferHolderName),
    clientNotes: escapeHtml(payload.clientNotes ?? ""),
  };
  const observationsHtml = safe.clientNotes
    ? `<p style="margin:16px 0 0;color:#6d6d6d;line-height:1.5"><strong>Observaciones:</strong> ${safe.clientNotes}</p>`
    : "";
  const mapsUrl =
    "https://www.google.com/maps/place/KANI+BARBER+STUDIO/data=!4m2!3m1!1s0x0:0x48bcfe7b2ea7ba60";
  const subject = `Recibimos tu solicitud en Kani Barber Studio · ${payload.bookingDate}`;
  const title = "Tu turno está pendiente de confirmación";
  const intro = `Recibimos tu solicitud correctamente. Para avanzar con la reserva, realizá la transferencia de la seña.`;
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f4f1eb;color:#1c1c1c;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.45"><div style="width:100%;padding:16px 10px;box-sizing:border-box"><div style="max-width:560px;margin:0 auto"><header style="background:#161616;padding:14px 18px;color:#f4f1eb;letter-spacing:.12em;font-size:15px;font-weight:700">Kani Barber Studio</header><main style="background:#fff;padding:22px 18px"><h1 style="margin:0;font-size:20px;line-height:1.2;font-weight:700">${title}</h1><p style="margin:12px 0 18px;color:#5f5f5f">Hola ${safe.clientName}.<br>${escapeHtml(intro)}</p><section style="background:#f8f5ef;border-left:4px solid #a37b43;padding:14px 15px;margin:0 0 18px"><h2 style="margin:0 0 2px;font-size:16px;line-height:1.25">Seña para reservar</h2><p style="margin:0 0 8px;font-size:26px;line-height:1.1;font-weight:700;color:#1c1c1c">${safe.downPayment}</p><p style="margin:0 0 12px;color:#5f5f5f">La seña está incluida en el importe total y se descuenta de este.</p><p style="margin:0 0 8px"><strong>Alias</strong><br>${safe.transferAlias}</p><p style="margin:0 0 8px"><strong>Titular</strong><br>${safe.transferHolderName}</p><p style="margin:0"><strong>CUIT</strong><br>${safe.transferCuit}</p></section><section style="border-top:1px solid #e5e0d8;padding-top:16px"><h2 style="margin:0 0 10px;font-size:16px;line-height:1.25">Detalles de tu turno</h2><p style="margin:0 0 5px;font-size:14px"><strong>${safe.serviceName}</strong> · ${payload.serviceDurationMinutes} min</p><p style="margin:0 0 5px">${safe.barberName}</p><p style="margin:0 0 12px">${safe.date} · ${safe.time}</p>${observationsHtml}<p style="margin:12px 0 4px"><strong>Valor total del servicio:</strong> ${safe.servicePrice}</p><p style="margin:0 0 4px"><strong>Importe de la seña:</strong> ${safe.downPayment}</p><p style="margin:0"><strong>Importe restante a abonar en el local:</strong> ${safe.remainingPayment}</p><p style="margin:8px 0 0;color:#5f5f5f">El importe restante se abona en el local, en efectivo o por transferencia.</p></section><section style="border-top:1px solid #e5e0d8;margin-top:16px;padding-top:14px"><h2 style="margin:0 0 6px;font-size:16px;line-height:1.25">Ubicación</h2><p style="margin:0 0 8px">Kani Barber Studio<br>San Isidro Labrador 7, Martínez, Provincia de Buenos Aires</p><a href="${mapsUrl}" style="color:#9f173b;font-weight:700">¿Cómo llegar?</a></section><p style="margin:18px 0 0;color:#5f5f5f">Tu turno quedará confirmado cuando ${safe.barberName} lo apruebe. Si realizás la transferencia, conservá el comprobante.</p><p style="margin:14px 0 0;color:#5f5f5f">Gracias por elegir Kani Barber Studio.</p></main><footer style="color:#8b8b8b;font-size:11px;line-height:1.4;text-align:center;padding:12px 8px">Mensaje automático de Kani Barber Studio.</footer></div></div></body></html>`;
  const text = `${title}\n\nHola ${payload.clientName}.\n${intro}\n\nSEÑA PARA RESERVAR\n${formatArs(payload.downPaymentArs)}\nLa seña está incluida en el importe total y se descuenta de este.\n\nAlias: ${payload.transferAlias}\nTitular: ${payload.transferHolderName}\nCUIT: ${payload.transferCuit}\n\nDETALLES DE TU TURNO\n${payload.serviceName} · ${payload.serviceDurationMinutes} min\n${payload.barberName}\n${date} · ${time}${payload.clientNotes?.trim() ? `\nObservaciones: ${payload.clientNotes.trim()}` : ""}\n\nValor total del servicio: ${formatArs(payload.servicePriceArs)}\nImporte de la seña: ${formatArs(payload.downPaymentArs)}\nImporte restante a abonar en el local: ${formatArs(Math.max(0, payload.servicePriceArs - payload.downPaymentArs))}\nEl importe restante se abona en el local, en efectivo o por transferencia.\n\nUBICACIÓN\nKani Barber Studio\nSan Isidro Labrador 7, Martínez, Provincia de Buenos Aires\n¿Cómo llegar?: ${mapsUrl}\n\nTu turno quedará confirmado cuando ${payload.barberName} lo apruebe. Si realizás la transferencia, conservá el comprobante.\n\nGracias por elegir Kani Barber Studio.`;
  return { subject, html, text };
}

function formatArs(value: number) {
  return `$ ${value.toLocaleString("es-AR")}`;
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character] ?? character,
  );
}

function safeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/Bearer\s+[^\s]+/gi, "Bearer [redacted]").slice(0, 500);
}
