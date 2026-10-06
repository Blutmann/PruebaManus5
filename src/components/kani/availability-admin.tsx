import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Check, CircleDot, LoaderCircle, Save, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { StaffBarber, StaffProfile } from '@/lib/kani-auth';
import { readAvailabilitySlots, updateAvailabilitySlot, type AvailabilitySlot } from '@/lib/kani-availability';
import { demoToday, type Barber } from '@/lib/kani-model';

export function AdminAvailability({
  profile,
  permittedRows,
  permittedBarbers,
}: {
  profile: StaffProfile;
  permittedRows: StaffBarber[];
  permittedBarbers: Barber[];
}) {
  const rowsByName = useMemo(() => new Map(permittedRows.map(row => [row.name, row])), [permittedRows]);
  const [selectedBarber, setSelectedBarber] = useState<Barber>(permittedBarbers[0] ?? 'Lautaro');
  const [selectedDate, setSelectedDate] = useState(demoToday);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!permittedBarbers.includes(selectedBarber)) setSelectedBarber(permittedBarbers[0] ?? 'Lautaro');
  }, [permittedBarbers, selectedBarber]);

  const barberRow = rowsByName.get(selectedBarber);
  const barberId = barberRow?.id;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!barberId) return;
      setLoading(true);
      setError('');
      setNotice('');
      try {
        const nextSlots = await readAvailabilitySlots(barberId, selectedDate);
        if (cancelled) return;
        setSlots(nextSlots);
        setNoteDrafts(Object.fromEntries(nextSlots.map(slot => [slot.id, slot.internal_note ?? ''])));
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'No se pudo cargar la disponibilidad real.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [barberId, selectedDate]);

  async function saveSlot(slot: AvailabilitySlot, changes: Partial<Pick<AvailabilitySlot, 'status' | 'internal_note'>>) {
    if (!barberId || slot.barber_id !== barberId) {
      setError('El slot no pertenece al barbero autorizado.');
      return;
    }
    setSavingId(slot.id);
    setError('');
    setNotice('');
    try {
      const updated = await updateAvailabilitySlot({
        id: slot.id,
        barberId,
        status: changes.status ?? slot.status,
        internalNote: changes.internal_note ?? (noteDrafts[slot.id] ?? slot.internal_note),
      });
      setSlots(current => current.map(currentSlot => currentSlot.id === updated.id ? updated : currentSlot));
      setNoteDrafts(current => ({ ...current, [updated.id]: updated.internal_note ?? '' }));
      setNotice(`${selectedBarber} · ${updated.start_time.slice(0, 5)} actualizado.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el slot.');
    } finally {
      setSavingId(null);
    }
  }

  return <section className="py-9">
    <div className="flex items-start justify-between gap-4">
      <div><h2 className="text-2xl">Horarios disponibles</h2><p className="mt-2 text-sm text-muted-foreground">Disponibilidad real persistida por fecha y hora.</p></div>
      <SlidersHorizontal className="text-gold" aria-hidden="true" />
    </div>
    <div className="mt-8 flex flex-wrap items-end gap-3">
      <div><label className="mb-2 block text-xs text-muted-foreground" htmlFor="availability-date">Fecha</label><Input id="availability-date" type="date" min={demoToday} value={selectedDate} onChange={event => setSelectedDate(event.target.value)} /></div>
      {profile.role === 'BARBER' ? <div><span className="mb-2 block text-xs text-muted-foreground">Barbero autorizado</span><span className="select-control block">{selectedBarber}</span></div> : <div className="flex flex-wrap gap-2"><span className="sr-only">Seleccionar barbero</span>{permittedBarbers.map(barber => <Button key={barber} variant="outline" aria-pressed={barber === selectedBarber} className={barber === selectedBarber ? 'selected' : ''} onClick={() => setSelectedBarber(barber)}><span className="small-avatar">{barber[0]}</span>{barber}<ArrowUpRight className="ml-auto" /></Button>)}</div>}
    </div>
    {notice && <div role="status" className="notice mt-6"><Check size={16} />{notice}<Button size="icon" variant="ghost" className="ml-auto" aria-label="Cerrar aviso" onClick={() => setNotice('')}><X /></Button></div>}
    {error && <p role="alert" className="mt-6 text-sm text-destructive">No se pudo completar la operación: {error}</p>}
    {loading ? <div className="py-12 text-center text-muted-foreground"><LoaderCircle className="mx-auto animate-spin" />Cargando slots reales…</div> : slots.length === 0 ? <div className="empty-state mt-8"><SlidersHorizontal size={32} /><h3 className="mt-4 text-lg">No hay slots para mostrar.</h3><p className="mt-2 text-sm text-muted-foreground">No se generaron slots nuevos. Elegí otra fecha dentro de la grilla existente.</p></div> : <div className="mt-8 space-y-3">
      {slots.map(slot => {
        const available = slot.status === 'AVAILABLE';
        const saving = savingId === slot.id;
        return <article key={slot.id} className="flex flex-col gap-4 border-b py-4 sm:flex-row sm:items-center sm:gap-6">
          <div className="flex w-24 items-center gap-3"><span className={`h-3 w-3 rounded-full ${available ? 'bg-emerald-500' : 'bg-red-500'}`} aria-label={available ? 'Disponible' : 'No disponible'} /><span className="text-xl">{slot.start_time.slice(0, 5)}</span></div>
          <button type="button" disabled={saving} className={`status flex min-w-40 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm ${available ? 'border-emerald-500/40 text-emerald-600' : 'border-red-500/40 text-red-600'}`} onClick={() => void saveSlot(slot, { status: available ? 'UNAVAILABLE' : 'AVAILABLE' })} aria-label={`${available ? 'Desactivar' : 'Activar'} ${slot.start_time.slice(0, 5)}`}><CircleDot size={13} />{available ? 'Disponible' : 'No disponible'}</button>
          <div className="flex min-w-0 flex-1 items-center gap-2"><Input value={noteDrafts[slot.id] ?? ''} onChange={event => setNoteDrafts(current => ({ ...current, [slot.id]: event.target.value }))} placeholder="Nota interna opcional" aria-label={`Nota interna ${slot.start_time.slice(0, 5)}`} maxLength={500} /><Button variant="outline" size="icon" disabled={saving} aria-label={`Guardar nota ${slot.start_time.slice(0, 5)}`} onClick={() => void saveSlot(slot, { internal_note: noteDrafts[slot.id] ?? '' })}>{saving ? <LoaderCircle className="animate-spin" /> : <Save />}</Button></div>
        </article>;
      })}
    </div>}
    <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground"><Check size={13} className="text-gold" />Los cambios se guardan en Supabase y permanecen al recargar.</p>
  </section>;
}
