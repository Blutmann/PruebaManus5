import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Check, CircleDot, LoaderCircle, Pencil, Plus, SlidersHorizontal, Trash2, X, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import type { StaffBarber, StaffProfile } from '@/lib/kani-auth';
import { createAvailabilitySlots, readAvailabilitySlots, updateAvailabilitySlot, type AvailabilitySlot } from '@/lib/kani-availability';
import { bookingEndDate, demoToday, type Barber } from '@/lib/kani-model';

const hours = Array.from({ length: 10 }, (_, index) => index + 10);
const minutes = Array.from({ length: 12 }, (_, index) => index * 5);

type ManualMode = 'today' | 'all';

function standardDates(fromDate: string) {
  const start = new Date(`${fromDate}T12:00:00`);
  return Array.from({ length: 22 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  }).filter(date => date.getDay() !== 0).map(date => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
}

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
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [deleteNoteSlot, setDeleteNoteSlot] = useState<AvailabilitySlot | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualHour, setManualHour] = useState('18');
  const [manualMinute, setManualMinute] = useState('30');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!permittedBarbers.includes(selectedBarber)) setSelectedBarber(permittedBarbers[0] ?? 'Lautaro');
  }, [permittedBarbers, selectedBarber]);

  const barberRow = rowsByName.get(selectedBarber);
  const barberId = barberRow?.id;
  const allowedManualMinutes = manualHour === '19' ? [0] : minutes;

  async function loadSlots() {
    if (!barberId) return;
    setLoading(true);
    setError('');
    try {
      const nextSlots = await readAvailabilitySlots(barberId, selectedDate);
      setSlots(nextSlots);
      setNoteDrafts(Object.fromEntries(nextSlots.map(slot => [slot.id, slot.internal_note ?? ''])));
      setEditingNoteId(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar la disponibilidad real.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!barberId) return;
      setLoading(true);
      setError('');
      try {
        const nextSlots = await readAvailabilitySlots(barberId, selectedDate);
        if (cancelled) return;
        setSlots(nextSlots);
        setNoteDrafts(Object.fromEntries(nextSlots.map(slot => [slot.id, slot.internal_note ?? ''])));
        setEditingNoteId(null);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'No se pudo cargar la disponibilidad real.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
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
        internalNote: changes.internal_note !== undefined ? changes.internal_note : slot.internal_note,
      });
      setSlots(current => current.map(currentSlot => currentSlot.id === updated.id ? updated : currentSlot));
      setNoteDrafts(current => ({ ...current, [updated.id]: updated.internal_note ?? '' }));
      setEditingNoteId(null);
      setNotice(`${selectedBarber} · ${updated.start_time.slice(0, 5)} actualizado.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el slot.');
    } finally {
      setSavingId(null);
    }
  }

  async function saveManualSlot(mode: ManualMode) {
    if (!barberId) return;
    setSavingId('manual');
    setError('');
    setNotice('');
    try {
      const dates = mode === 'today' ? [selectedDate] : standardDates(demoToday);
      const created = await createAvailabilitySlots({ barberId, dates, startTime: `${manualHour}:${manualMinute}` });
      setManualOpen(false);
      await loadSlots();
      setNotice(created.length > 0
        ? `${selectedBarber} · horario ${manualHour}:${manualMinute} guardado.`
        : 'Ese horario ya existía; no se creó un duplicado.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo crear el horario manual.');
    } finally {
      setSavingId(null);
    }
  }

  return <section className="py-9">
    <div className="availability-heading">
      <div><h2 className="text-2xl">Horarios</h2></div>
    </div>
    <div className="mt-8 flex flex-wrap items-end gap-3">
      <div><label className="mb-2 block text-xs text-muted-foreground" htmlFor="availability-date">Fecha</label><Input id="availability-date" type="date" min={demoToday} max={bookingEndDate} value={selectedDate} onChange={event => setSelectedDate(event.target.value)} /></div>
      {profile.role === 'BARBER' ? <div><span className="mb-2 block text-xs text-muted-foreground">Barbero autorizado</span><span className="select-control block">{selectedBarber}</span></div> : <div className="flex flex-wrap gap-2"><span className="sr-only">Seleccionar barbero</span>{permittedBarbers.map(barber => <Button key={barber} variant="outline" aria-pressed={barber === selectedBarber} className={barber === selectedBarber ? 'selected' : ''} onClick={() => setSelectedBarber(barber)}><span className="small-avatar">{barber[0]}</span>{barber}<ArrowUpRight className="ml-auto" /></Button>)}</div>}
      <Button className="action-positive ml-auto" onClick={() => setManualOpen(true)}><Plus />Agregar un nuevo horario</Button>
    </div>
    {notice && <div role="status" className="notice mt-6"><Check size={16} />{notice}<Button size="icon" variant="ghost" className="ml-auto" aria-label="Cerrar aviso" onClick={() => setNotice('')}><X /></Button></div>}
    {error && <p role="alert" className="mt-6 text-sm text-destructive">No se pudo completar la operación: {error}</p>}
    {loading ? <div className="py-12 text-center text-muted-foreground"><LoaderCircle className="mx-auto animate-spin" />Cargando slots reales…</div> : slots.length === 0 ? <div className="empty-state mt-8"><SlidersHorizontal size={32} /><h3 className="mt-4 text-lg">No hay slots para mostrar.</h3><p className="mt-2 text-muted-foreground">Podés agregar un horario manual para esta fecha.</p></div> : <><div className="availability-admin-header"><span>HORARIO</span><span>ESTADO</span><span>NOTAS</span></div><div className="mt-3 space-y-3">
      {slots.map(slot => {
        const available = slot.status === 'AVAILABLE';
        const saving = savingId === slot.id;
        const existingNote = slot.internal_note?.trim() ?? '';
        const noteDraft = noteDrafts[slot.id] ?? existingNote;
        const noteChanged = noteDraft.trim() !== existingNote;
        const editing = editingNoteId === slot.id;
        return <article key={slot.id} className="availability-admin-row">
          <div className="availability-time"><span className={`h-3 w-3 rounded-full ${available ? 'bg-emerald-500' : 'bg-red-500'}`} aria-hidden="true" /><span className="text-xl">{slot.start_time.slice(0, 5)}</span><span className="text-xs text-muted-foreground">· {slot.end_time.slice(0, 5)}</span></div>
          <div className="availability-status-toggle" role="group" aria-label={`Estado ${slot.start_time.slice(0, 5)}`}><Button type="button" disabled={saving} className={available ? 'availability-state selected available' : 'availability-state available'} aria-pressed={available} onClick={() => void saveSlot(slot, { status: 'AVAILABLE' })}><CircleDot size={13} />Disponible</Button><Button type="button" disabled={saving} className={!available ? 'availability-state selected unavailable' : 'availability-state unavailable'} aria-pressed={!available} onClick={() => void saveSlot(slot, { status: 'UNAVAILABLE' })}><XCircle size={13} />No disponible</Button></div>
          <div className="availability-note-cell">{editing || !existingNote ? <div className="availability-note-editor"><Input value={noteDraft} onChange={event => setNoteDrafts(current => ({ ...current, [slot.id]: event.target.value }))} placeholder="Nota interna opcional" aria-label={`Nota interna ${slot.start_time.slice(0, 5)}`} maxLength={500} /><Button variant="outline" size="icon" className="action-positive" disabled={saving || !noteChanged} aria-label={`Guardar nota ${slot.start_time.slice(0, 5)}`} onClick={() => void saveSlot(slot, { internal_note: noteDraft })}>{saving ? <LoaderCircle className="animate-spin" /> : <Check />}</Button>{editing && <Button variant="ghost" size="icon" disabled={saving} aria-label="Cancelar edición de nota" onClick={() => { setNoteDrafts(current => ({ ...current, [slot.id]: existingNote })); setEditingNoteId(null); }}><X /></Button>}</div> : <div className="availability-note-compact"><span title={existingNote}>{existingNote}</span><Button variant="ghost" size="icon" aria-label={`Editar nota ${slot.start_time.slice(0, 5)}`} onClick={() => setEditingNoteId(slot.id)}><Pencil /></Button><Button variant="ghost" size="icon" className="action-brand-text" aria-label={`Eliminar nota ${slot.start_time.slice(0, 5)}`} onClick={() => setDeleteNoteSlot(slot)}><Trash2 /></Button></div>}</div>
        </article>;
      })}
    </div></>}
    <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground"><Check size={13} className="text-gold" />Los cambios se guardan en Supabase y permanecen al recargar.</p>
    <Dialog open={manualOpen} onOpenChange={open => { if (!open && savingId !== 'manual') setManualOpen(false); }}><DialogContent className="manual-dialog max-w-[calc(100%-32px)] sm:max-w-md"><DialogTitle>Agregar un nuevo horario</DialogTitle><DialogDescription>Elegí un inicio en intervalos de 5 minutos. El slot dura una hora y respeta el horario operativo.</DialogDescription><div className="manual-time-fields"><div><label htmlFor="manual-hour">Hora</label><select id="manual-hour" className="select-control w-full" value={manualHour} onChange={event => setManualHour(event.target.value)}>{hours.map(hour => <option key={hour} value={String(hour)}>{String(hour).padStart(2, '0')}</option>)}</select></div><span>:</span><div><label htmlFor="manual-minute">Minutos</label><select id="manual-minute" className="select-control w-full" value={manualMinute} onChange={event => setManualMinute(event.target.value)}>{allowedManualMinutes.map(minute => <option key={minute} value={String(minute)}>{String(minute).padStart(2, '0')}</option>)}</select></div></div><p className="manual-dialog-date text-xs text-muted-foreground">Fecha seleccionada: {selectedDate}</p><DialogFooter className="manual-dialog-footer"><Button variant="outline" disabled={savingId === 'manual'} onClick={() => setManualOpen(false)}>Cancelar</Button><Button className="action-positive" disabled={savingId === 'manual'} onClick={() => void saveManualSlot('today')}>Guardar solo para hoy</Button><Button className="action-positive" disabled={savingId === 'manual'} onClick={() => void saveManualSlot('all')}>Guardar para todos los días</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={Boolean(deleteNoteSlot)} onOpenChange={open => { if (!open) setDeleteNoteSlot(null); }}><DialogContent className="max-w-[calc(100%-32px)] sm:max-w-md"><DialogTitle>¿Eliminar nota interna?</DialogTitle><DialogDescription>La nota de {deleteNoteSlot?.start_time.slice(0, 5)} se eliminará de este horario.</DialogDescription><DialogFooter><Button variant="outline" onClick={() => setDeleteNoteSlot(null)}>Cancelar</Button><Button className="action-brand" onClick={() => { if (!deleteNoteSlot) return; void saveSlot(deleteNoteSlot, { internal_note: null }); setDeleteNoteSlot(null); }}>Eliminar nota</Button></DialogFooter></DialogContent></Dialog>
  </section>;
}
