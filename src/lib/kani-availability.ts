import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { bookingEndDateFor, isBookingDate, minutes, services, type Barber } from '@/lib/kani-model';
import { BUSINESS_TIME_ZONE, businessDateToday } from '@/lib/kani-mobile-appointments';

export type AvailabilitySlot = Tables<'barber_availability_slots'>;
export type PublicAvailabilitySlot = Omit<Tables<'available_barber_slots'>, 'status'> & {
  status: AvailabilitySlot['status'];
  barber_name: Barber;
};
export type ConfiguredService = Omit<(typeof services)[number], 'price' | 'duration'> & {
  price: number;
  duration: number;
};

const slotFields = 'id, barber_id, slot_date, start_time, end_time, status, internal_note, created_at, updated_at, updated_by';
const publicSlotFields = 'id, barber_id, slot_date, start_time, end_time, status';

export async function readConfiguredServices(): Promise<ConfiguredService[]> {
  const { data, error } = await supabase
    .from('services')
    .select('name, duration_minutes, price_ars')
    .eq('active', true)
    .order('name', { ascending: true });
  if (error) throw error;

  const byName = new Map((data ?? []).map(row => [row.name, row]));
  return services.flatMap(service => {
    const configured = byName.get(service.name);
    return configured ? [{ ...service, price: configured.price_ars, duration: configured.duration_minutes }] : [];
  });
}

export async function readPublicAvailabilitySlots(barber: Barber | null, fromDate: string, toDate: string) {
  let barberQuery = supabase.from('barbers').select('id, name').eq('active', true);
  if (barber) barberQuery = barberQuery.eq('name', barber);
  const { data: barberRows, error: barberError } = await barberQuery;
  if (barberError) throw barberError;
  if (!barberRows?.length) return [] as PublicAvailabilitySlot[];

  const barberById = new Map(barberRows.map(row => [row.id, row.name as Barber]));
  const { data, error } = await supabase
    .from('available_barber_slots')
    .select(publicSlotFields)
    .in('barber_id', barberRows.map(row => row.id))
    .gte('slot_date', fromDate)
    .lte('slot_date', toDate)
    .order('slot_date', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) throw error;
  return (data ?? []).flatMap(slot => {
    const barberName = barberById.get(slot.barber_id);
    return barberName ? [{ ...slot, barber_name: barberName }] : [];
  }) as PublicAvailabilitySlot[];
}

function businessClockMinutes(now: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: BUSINESS_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const hour = Number(parts.find(part => part.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find(part => part.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

export function slotCanStillBeBooked(slotDate: string, startTime: string, now: Date) {
  const today = businessDateToday(now);
  return slotDate !== today || minutes(startTime.slice(0, 5)) > businessClockMinutes(now);
}

export function availableTimesForServiceDate(slots: PublicAvailabilitySlot[], date: string, duration: number, now: Date, barber?: Barber | null) {
  return [...new Set(slots
    .filter(slot => slot.slot_date === date && slot.status === 'AVAILABLE')
    .filter(slot => !barber || slot.barber_name === barber)
    .filter(slot => minutes(slot.end_time.slice(0, 5)) - minutes(slot.start_time.slice(0, 5)) >= duration)
    .filter(slot => slotCanStillBeBooked(slot.slot_date, slot.start_time, now))
    .map(slot => slot.start_time.slice(0, 5)))].sort();
}

export function eligibleBarbersForServiceSlot(slots: PublicAvailabilitySlot[], date: string, time: string, duration: number, now: Date) {
  return [...new Set(slots
    .filter(slot => slot.slot_date === date && slot.status === 'AVAILABLE' && slot.start_time.slice(0, 5) === time)
    .filter(slot => minutes(slot.end_time.slice(0, 5)) - minutes(slot.start_time.slice(0, 5)) >= duration)
    .filter(slot => slotCanStillBeBooked(slot.slot_date, slot.start_time, now))
    .map(slot => slot.barber_name))];
}

export async function readAvailabilitySlots(barberId: string, slotDate: string) {
  return readAvailabilitySlotsForRange(barberId, { start: slotDate, end: slotDate });
}

export async function readAvailabilitySlotsForRange(
  barberId: string,
  range: { start?: string; end?: string } | null = null,
) {
  let query = supabase
    .from('barber_availability_slots')
    .select(slotFields)
    .eq('barber_id', barberId);

  if (range?.start) query = query.gte('slot_date', range.start);
  if (range?.end) query = query.lte('slot_date', range.end);

  const { data: rangedData, error: rangedError } = await query
    .order('slot_date', { ascending: true })
    .order('start_time', { ascending: true });

  if (rangedError) throw rangedError;
  return rangedData as AvailabilitySlot[];
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

  const { data, error } = await supabase.rpc('update_availability_slot', {
    p_slot_id: id,
    p_status: status,
    p_internal_note: internalNote?.trim() || null,
  });

  if (error) throw error;
  const updated = data?.[0];
  if (!updated || updated.barber_id !== barberId) throw new Error('El slot no pertenece al barbero autorizado.');
  return updated as AvailabilitySlot;
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
  const minutesValue = Number(minutesText);
  if (!Number.isInteger(hours) || !Number.isInteger(minutesValue) || hours < 0 || hours > 23 || minutesValue < 0 || minutesValue > 59 || minutesValue % 5 !== 0) {
    throw new Error('El horario debe estar entre las 00:00 y las 23:55, en intervalos de 5 minutos.');
  }

  const businessToday = businessDateToday();
  const bookingEndDate = bookingEndDateFor(businessToday);
  const validDates = dates.filter(slotDate => isBookingDate(slotDate, businessToday, bookingEndDate));
  if (validDates.length !== dates.filter(Boolean).length) throw new Error(`La fecha debe ser un día de atención entre ${businessToday} y ${bookingEndDate}.`);
  if (validDates.length === 0) throw new Error('Elegí al menos una fecha.');

  const { data, error } = await supabase.rpc('create_availability_slots', {
    p_barber_id: barberId,
    p_slot_dates: validDates,
    p_start_time: `${String(hours).padStart(2, '0')}:${String(minutesValue).padStart(2, '0')}:00`,
  });

  if (error) throw error;
  return (data ?? []) as AvailabilitySlot[];
}

export type DashboardAvailabilitySlot = Pick<AvailabilitySlot, 'id' | 'barber_id' | 'slot_date' | 'start_time' | 'end_time' | 'status'>;

export async function readDashboardAvailabilitySlots(fromDate: string, toDate: string) {
  const { data, error } = await supabase
    .from('barber_availability_slots')
    .select('id, barber_id, slot_date, start_time, end_time, status')
    .gte('slot_date', fromDate)
    .lte('slot_date', toDate)
    .order('slot_date', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) throw error;
  return (data ?? []) as DashboardAvailabilitySlot[];
}
