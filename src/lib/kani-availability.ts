import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export type AvailabilitySlot = Tables<'barber_availability_slots'>;

const slotFields = 'id, barber_id, slot_date, start_time, end_time, status, internal_note, created_at, updated_at, updated_by';

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
