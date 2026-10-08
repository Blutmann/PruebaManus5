import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { bookingEndDate, isBookingDate, type Barber } from '@/lib/kani-model';

export type AvailabilitySlot = Tables<'barber_availability_slots'>;
export type PublicAvailabilitySlot = Tables<'available_barber_slots'>;

const slotFields = 'id, barber_id, slot_date, start_time, end_time, status, internal_note, created_at, updated_at, updated_by';
const publicSlotFields = 'id, barber_id, slot_date, start_time, end_time, status';

export async function readPublicAvailabilitySlots(barber: Barber, fromDate: string, toDate: string) {
  const { data: barberRow, error: barberError } = await supabase
    .from('barbers')
    .select('id')
    .eq('name', barber)
    .eq('active', true)
    .single();

  if (barberError) throw barberError;

  const { data, error } = await supabase
    .from('available_barber_slots')
    .select(publicSlotFields)
    .eq('barber_id', barberRow.id)
    .gte('slot_date', fromDate)
    .lte('slot_date', toDate)
    .order('slot_date', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) throw error;
  return data as PublicAvailabilitySlot[];
}

export async function readAvailabilitySlots(barberId: string, slotDate: string) {
  const { data, error } = await supabase
    .from('barber_availability_slots')
    .select(slotFields)
    .eq('barber_id', barberId)
    .eq('slot_date', slotDate)
    .order('start_time', { ascending: true });

  if (error) throw error;
  return data as AvailabilitySlot[];
}

export async function updateAvailabilitySlot({
  id,
  barberId,
  status,
  internalNote,
}: {
  id: string;
  barberId: string;
  status: AvailabilitySlot['status'];
  internalNote: string | null;
}) {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw userError ?? new Error('Sesión no disponible');

  const { data, error } = await supabase
    .from('barber_availability_slots')
    .update({
      status,
      internal_note: internalNote?.trim() || null,
      updated_by: user.id,
    })
    .eq('id', id)
    .eq('barber_id', barberId)
    .select(slotFields)
    .single();

  if (error) throw error;
  return data as AvailabilitySlot;
}

export async function createAvailabilitySlots({
  barberId,
  dates,
  startTime,
}: {
  barberId: string;
  dates: string[];
  startTime: string;
}) {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw userError ?? new Error('Sesión no disponible');

  const [hoursText, minutesText] = startTime.split(':');
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 10 || hours >= 20 || minutes % 5 !== 0) {
    throw new Error('El horario debe estar entre las 10:00 y las 19:55, en intervalos de 5 minutos.');
  }
  const endMinutes = hours * 60 + minutes + 60;
  if (endMinutes > 20 * 60) throw new Error('El horario termina fuera del horario operativo.');

  const validDates = dates.filter(slotDate => isBookingDate(slotDate));
  if (validDates.length !== dates.filter(Boolean).length) throw new Error(`La fecha debe estar entre ${new Date(`${bookingEndDate}T12:00:00`).toLocaleDateString('es-AR')} y dentro de los días de atención.`);

  const rows = validDates.map(slotDate => ({
    barber_id: barberId,
    slot_date: slotDate,
    start_time: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`,
    end_time: `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}:00`,
    status: 'AVAILABLE' as const,
    updated_by: user.id,
  }));
  if (rows.length === 0) throw new Error('Elegí al menos una fecha.');

  const { data, error } = await supabase
    .from('barber_availability_slots')
    .upsert(rows, { onConflict: 'barber_id,slot_date,start_time', ignoreDuplicates: true })
    .select(slotFields);

  if (error) throw error;
  return (data ?? []) as AvailabilitySlot[];
}
