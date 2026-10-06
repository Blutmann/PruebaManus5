import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import type { Appointment, Barber, ServiceId, Status } from '@/lib/kani-model';

export type RealAppointmentStatus = Tables<'appointments'>['status'];
export type RealAppointment = Appointment & { notes: string; statusCode: RealAppointmentStatus; barberId: string; serviceId: string };

type AppointmentRow = Tables<'appointments'>;

type CreateAppointmentInput = {
  barber: Barber;
  serviceName: string;
  date: string;
  time: string;
  name: string;
  phone: string;
  email: string;
  notes?: string;
};

const statusToUi: Record<RealAppointmentStatus, Status> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmado',
  CANCELLED: 'Cancelado',
  COMPLETED: 'Completado',
};

export function appointmentErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('SLOT_ALREADY_BOOKED')) return 'Ese horario acaba de dejar de estar disponible. Elegí otro para continuar.';
  if (message.includes('SLOT_UNAVAILABLE')) return 'Ese horario ya no está disponible. Elegí otro para continuar.';
  if (message.includes('BOOKING_DATE_OUT_OF_RANGE')) return 'La fecha seleccionada ya no está disponible.';
  if (message.includes('SUNDAY_CLOSED')) return 'El estudio permanece cerrado los domingos.';
  return 'No se pudo guardar la solicitud. Revisá los datos e intentá nuevamente.';
}

export async function createRealAppointment(input: CreateAppointmentInput) {
  const { data, error } = await supabase.rpc('request_appointment', {
    p_barber_name: input.barber,
    p_service_name: input.serviceName,
    p_booking_date: input.date,
    p_start_time: input.time,
    p_client_name: input.name,
    p_client_phone: input.phone,
    p_client_email: input.email,
    p_notes: input.notes?.trim() || null,
  });
  if (error) throw error;
  const row = data?.[0];
  if (!row) throw new Error('La reserva no devolvió un resultado válido.');
  return row;
}

export async function readRealAppointments() {
  const { data: rows, error } = await supabase
    .from('appointments')
    .select('id, client_id, barber_id, service_id, booking_date, start_time, end_time, status, notes, created_at, updated_at')
    .order('booking_date', { ascending: true })
    .order('start_time', { ascending: true });
  if (error) throw error;
  const appointments = (rows ?? []) as AppointmentRow[];
  const clientIds = [...new Set(appointments.map(row => row.client_id))];
  const barberIds = [...new Set(appointments.map(row => row.barber_id))];
  const serviceIds = [...new Set(appointments.map(row => row.service_id))];
  const [{ data: clients, error: clientsError }, { data: barbers, error: barbersError }, { data: services, error: servicesError }] = await Promise.all([
    clientIds.length ? supabase.from('clients').select('id, name, phone, email').in('id', clientIds) : Promise.resolve({ data: [], error: null }),
    barberIds.length ? supabase.from('barbers').select('id, name').in('id', barberIds) : Promise.resolve({ data: [], error: null }),
    serviceIds.length ? supabase.from('services').select('id, name, duration_minutes').in('id', serviceIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (clientsError || barbersError || servicesError) throw clientsError ?? barbersError ?? servicesError;
  const clientById = new Map((clients ?? []).map(client => [client.id, client]));
  const barberById = new Map((barbers ?? []).map(barber => [barber.id, barber]));
  const serviceById = new Map((services ?? []).map(service => [service.id, service]));
  return appointments.flatMap(row => {
    const client = clientById.get(row.client_id);
    const barber = barberById.get(row.barber_id);
    const service = serviceById.get(row.service_id);
    if (!client || !barber || !service) return [];
    return [{
      id: row.id,
      service: serviceIdForName(service.name),
      barber: barber.name as Barber,
      date: row.booking_date,
      time: row.start_time.slice(0, 5),
      name: client.name,
      email: client.email,
      phone: client.phone,
      status: statusToUi[row.status],
      notes: row.notes ?? '',
      statusCode: row.status,
      barberId: row.barber_id,
      serviceId: row.service_id,
    } satisfies RealAppointment];
  });
}

export async function updateRealAppointmentStatus(id: string, status: 'CONFIRMED' | 'CANCELLED' | 'COMPLETED') {
  const { data, error } = await supabase.rpc('update_appointment_status', {
    p_appointment_id: id,
    p_status: status,
  });
  if (error) throw error;
  return data;
}

function serviceIdForName(name: string): ServiceId {
  if (name === 'Corte + barba') return 'corte-barba';
  if (name === 'Barba') return 'barba';
  return 'corte';
}
