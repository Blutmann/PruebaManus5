import { useEffect, useMemo, useState } from 'react';
import { Check, CircleDot, Clock3, LoaderCircle, Pencil, Plus, SlidersHorizontal, Trash2, X, XCircle } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useAdminStaff } from '@/lib/kani-admin-context';
import { businessDateToday, dateRangeForMobilePreset, mobileDatePresetLabels, type MobileDatePreset } from '@/lib/kani-mobile-appointments';
import { bookingEndDateFor, dateLabel, minutes, type Barber } from '@/lib/kani-model';
import { createAvailabilitySlots, readAvailabilitySlotsForRange, updateAvailabilitySlot, type AvailabilitySlot } from '@/lib/kani-availability';
import { readRealAppointments, type RealAppointment } from '@/lib/kani-appointments';
import { permittedBarberNames } from '@/lib/kani-role-scope';

const datePresets: MobileDatePreset[] = ['ALL', 'TODAY', 'TOMORROW', 'NEXT_10_DAYS', 'THIS_WEEK', 'SPECIFIC'];
const hours = Array.from({ length: 24 }, (_, index) => index);
const manualMinutes = Array.from({ length: 12 }, (_, index) => index * 5);

type ScheduleSlot = AvailabilitySlot & { barberName: Barber; occupied: boolean };

function errorMessage(cause: unknown) {
  const message = cause instanceof Error ? cause.message : '';
  if (message.includes('AVAILABILITY_OVERLAP')) return 'Ese horario se superpone con otro horario existente.';
  if (message.includes('AVAILABILITY_APPOINTMENT_CONFLICT')) return 'Ese horario se superpone con una reserva existente.';
  if (message.includes('AVAILABILITY_DATE_INVALID')) return 'Elegí una fecha de atención dentro del período permitido.';
  if (message.includes('AVAILABILITY_NOT_ALLOWED')) return 'No tenés permiso para modificar esa agenda.';
  if (message.includes('INTERNAL_NOTE_TOO_LONG')) return 'El comentario no puede superar los 500 caracteres.';
  return message || 'No se pudo completar la operación.';
}

function overlaps(slot: AvailabilitySlot, appointment: RealAppointment) {
  if (appointment.statusCode === 'CANCELLED' || slot.barber_id !== appointment.barberId || slot.slot_date !== appointment.date) return false;
  const slotStart = minutes(slot.start_time.slice(0, 5));
  const slotEnd = slot.end_time.slice(0, 5) <= slot.start_time.slice(0, 5) ? minutes(slot.end_time.slice(0, 5)) + 24 * 60 : minutes(slot.end_time.slice(0, 5));
  const appointmentStart = minutes(appointment.time);
  const appointmentEnd = appointment.endTime ? minutes(appointment.endTime) : appointmentStart;
  return slotStart < appointmentEnd && appointmentStart < slotEnd;
}

export function AdminScheduleManager() {
  const { profile, barbers: permittedRows } = useAdminStaff();
  const permittedBarbers = useMemo(() => permittedBarberNames(profile, permittedRows), [permittedRows, profile]);
  const barberById = useMemo(() => new Map(permittedRows.map(row => [row.id, row])), [permittedRows]);
  const ownBarberId = profile.role === 'BARBER' ? profile.barber_id : null;
  const [datePreset, setDatePreset] = useState<MobileDatePreset>('ALL');
  const [specificDate, setSpecificDate] = useState('');
  const [businessToday, setBusinessToday] = useState(() => businessDateToday());
  const [barberFilter, setBarberFilter] = useState('Todos');
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [manualOpen, setManualOpen] = useState(false);
  const [manualDate, setManualDate] = useState(() => businessDateToday());
  const [manualBarberId, setManualBarberId] = useState(() => ownBarberId ?? permittedRows[0]?.id ?? '');
  const [manualHour, setManualHour] = useState('10');
  const [manualMinute, setManualMinute] = useState('00');

  useEffect(() => {
    if (profile.role === 'BARBER') {
      setBarberFilter(permittedBarbers[0] ?? '');
      setManualBarberId(ownBarberId ?? '');
    } else if (!permittedRows.some(row => row.id === manualBarberId)) {
      setManualBarberId(permittedRows[0]?.id ?? '');
    }
  }, [manualBarberId, ownBarberId, permittedBarbers, permittedRows, profile.role]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      const next = businessDateToday();
      setBusinessToday(current => current === next ? current : next);
      setManualDate(current => current < next ? next : current);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const dateRange = useMemo(() => dateRangeForMobilePreset(datePreset, businessToday, specificDate), [businessToday, datePreset, specificDate]);
  const selectedRows = useMemo(() => {
    if (profile.role === 'BARBER') return ownBarberId ? permittedRows.filter(row => row.id === ownBarberId) : [];
    return barberFilter === 'Todos' ? permittedRows : permittedRows.filter(row => row.name === barberFilter);
  }, [barberFilter, ownBarberId, permittedRows, profile.role]);

  async function loadSlots() {
    setLoading(true);
    setError('');
    try {
      const [slotRows, appointments] = await Promise.all([
        Promise.all(selectedRows.map(row => readAvailabilitySlotsForRange(row.id, dateRange))).then(rows => rows.flat()),
        readRealAppointments(),
      ]);
      const nextSlots = slotRows
        .map(slot => ({ ...slot, barberName: (barberById.get(slot.barber_id)?.name ?? 'Barbero') as Barber, occupied: appointments.some(appointment => overlaps(slot, appointment)) }))
        .sort((a, b) => `${a.slot_date}${a.start_time}`.localeCompare(`${b.slot_date}${b.start_time}`));
      setSlots(nextSlots);
      setNoteDrafts(Object.fromEntries(nextSlots.map(slot => [slot.id, slot.internal_note ?? ''])));
      setEditingNoteId(null);
    } catch (cause) {
      setSlots([]);
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadSlots(); }, [dateRange, selectedRows]);

  function selectPreset(next: MobileDatePreset) {
    setSpecificDate(next === 'SPECIFIC' ? specificDate || businessToday : '');
    setDatePreset(next);
  }

  function selectSpecificDate(next: string) {
    setSpecificDate(next);
    setDatePreset(next ? 'SPECIFIC' : 'ALL');
  }

  async function saveSlot(slot: ScheduleSlot, changes: Partial<Pick<AvailabilitySlot, 'status' | 'internal_note'>>) {
    if (slot.occupied && changes.status === 'UNAVAILABLE') {
      setError('No se puede bloquear un horario que ya tiene una reserva activa.');
      return;
    }
    setSavingId(slot.id);
    setError('');
    setNotice('');
    try {
      const updated = await updateAvailabilitySlot({ id: slot.id, barberId: slot.barber_id, status: changes.status ?? slot.status, internalNote: changes.internal_note !== undefined ? changes.internal_note : slot.internal_note });
      setSlots(current => current.map(currentSlot => currentSlot.id === updated.id ? { ...updated, barberName: slot.barberName, occupied: slot.occupied } : currentSlot));
      setNoteDrafts(current => ({ ...current, [updated.id]: updated.internal_note ?? '' }));
      setEditingNoteId(null);
      setNotice(`${slot.barberName} · ${updated.start_time.slice(0, 5)} actualizado.`);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSavingId(null);
    }
  }

  async function saveManualSlot() {
    if (!manualBarberId || !manualDate) return;
    setSavingId('manual');
    setError('');
    setNotice('');
    try {
      const created = await createAvailabilitySlots({ barberId: manualBarberId, dates: [manualDate], startTime: `${manualHour}:${manualMinute}` });
      setManualOpen(false);
      await loadSlots();
      const barberName = barberById.get(manualBarberId)?.name ?? 'Agenda';
      setNotice(created.length > 0 ? `${barberName} · horario ${manualHour}:${manualMinute} guardado.` : 'Ese horario ya existía; no se creó un duplicado.');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSavingId(null);
    }
  }

  const groupedSlots = useMemo(() => {
    const groups = new Map<string, ScheduleSlot[]>();
    slots.forEach(slot => groups.set(slot.slot_date, [...(groups.get(slot.slot_date) ?? []), slot]));
    return [...groups.entries()];
  }, [slots]);
  const contextLabel = profile.role === 'BARBER' ? 'Tu agenda' : barberFilter === 'Todos' ? 'Agenda de todos los barberos' : `Agenda de ${barberFilter}`;
  const manualEndDate = bookingEndDateFor(businessToday);

  return <main className="site-container admin-schedule-page">
    <div className="admin-schedule-shell">
      <header className="admin-schedule-heading"><div><Link to="/admin/movil" className="admin-schedule-back">← Panel móvil</Link><span className="eyebrow">DISPONIBILIDAD</span><h1 className="section-title">Gestiona tus horarios</h1><p className="admin-schedule-context">{contextLabel}</p></div><Button className="action-positive admin-schedule-add" onClick={() => setManualOpen(true)}><Plus size={17} />Agregar horario</Button></header>
      <section className="admin-schedule-filters" aria-label="Filtros de horarios"><div className="admin-schedule-date-filter"><label htmlFor="schedule-date-preset">Período</label><div className="admin-schedule-date-controls"><select id="schedule-date-preset" value={datePreset} onChange={event => selectPreset(event.target.value as MobileDatePreset)}>{datePresets.map(preset => <option key={preset} value={preset}>{mobileDatePresetLabels[preset]}</option>)}</select><input id="schedule-specific-date" type="date" value={specificDate} onChange={event => selectSpecificDate(event.target.value)} aria-label="Fecha específica" /></div></div>{profile.role === 'ADMIN' && <div className="admin-schedule-barber-filter"><label htmlFor="schedule-barber-filter">Barbero</label><select id="schedule-barber-filter" value={barberFilter} onChange={event => setBarberFilter(event.target.value)}><option value="Todos">Todos</option>{permittedBarbers.map(barber => <option key={barber} value={barber}>{barber}</option>)}</select></div>}</section>
      <div className="admin-schedule-legend" aria-label="Leyenda de horarios"><span><CircleDot size={14} />Disponible</span><span><XCircle size={14} />No disponible</span><span><Clock3 size={14} />Con reserva</span></div>
      {notice && <div role="status" className="admin-mobile-notice"><Check size={16} />{notice}<Button variant="ghost" size="icon" aria-label="Cerrar aviso" onClick={() => setNotice('')}><X /></Button></div>}
      {error && <div role="alert" className="admin-mobile-notice is-error"><XCircle size={16} />{error}</div>}
      <section className="admin-schedule-list" aria-label="Disponibilidad horaria">
        {loading && <div className="admin-mobile-empty"><Clock3 size={28} /><p>Cargando horarios…</p></div>}
        {!loading && groupedSlots.length === 0 && <div className="admin-mobile-empty"><SlidersHorizontal size={28} /><h2>No hay horarios para estos filtros.</h2><p>Podés agregar una disponibilidad dentro del período de atención.</p></div>}
        {!loading && groupedSlots.map(([date, dateSlots]) => <section key={date} className="admin-schedule-day"><div className="admin-schedule-day-heading"><div><span className="eyebrow">FECHA</span><h2>{dateLabel(date)}</h2></div><span>{dateSlots.length} {dateSlots.length === 1 ? 'horario' : 'horarios'}</span></div><div className="admin-schedule-cards">{dateSlots.map(slot => {
          const available = slot.status === 'AVAILABLE';
          const existingNote = slot.internal_note?.trim() ?? '';
          const noteDraft = noteDrafts[slot.id] ?? existingNote;
          const editing = editingNoteId === slot.id;
          const saving = savingId === slot.id;
          const slotTone = slot.occupied ? 'occupied' : available ? 'available' : 'unavailable';
          return <article key={slot.id} className={`admin-schedule-card is-${slotTone}`}>
            <div className="admin-schedule-card-top"><div className="admin-schedule-time"><strong>{slot.start_time.slice(0, 5)}</strong><span>hasta {slot.end_time.slice(0, 5)}</span></div><span className={`admin-schedule-status ${slotTone}`}>{slot.occupied ? <Clock3 size={14} /> : available ? <CircleDot size={14} /> : <XCircle size={14} />}{slot.occupied ? 'Con reserva' : available ? 'Disponible' : 'No disponible'}</span></div>
            {profile.role === 'ADMIN' && <p className="admin-schedule-barber"><span className="small-avatar">{slot.barberName[0]}</span>{slot.barberName}</p>}
            <div className="admin-schedule-toggle"><Button type="button" disabled={saving || slot.occupied} className={available && !slot.occupied ? 'selected available' : 'available'} aria-pressed={available && !slot.occupied} onClick={() => void saveSlot(slot, { status: 'AVAILABLE' })}><Check size={14} />Habilitar</Button><Button type="button" disabled={saving || slot.occupied} className={!available && !slot.occupied ? 'selected unavailable' : 'unavailable'} aria-pressed={!available && !slot.occupied} onClick={() => void saveSlot(slot, { status: 'UNAVAILABLE' })}><XCircle size={14} />Deshabilitar</Button></div>
            <div className="admin-schedule-note"><span className="eyebrow">COMENTARIO INTERNO</span>{editing || !existingNote ? <div className="admin-schedule-note-editor"><Input value={noteDraft} onChange={event => setNoteDrafts(current => ({ ...current, [slot.id]: event.target.value }))} placeholder="Agregar comentario opcional" maxLength={500} aria-label={`Comentario interno ${slot.start_time.slice(0, 5)}`} /><Button variant="outline" size="icon" disabled={saving || noteDraft.trim() === existingNote} aria-label="Guardar comentario" onClick={() => void saveSlot(slot, { internal_note: noteDraft })}>{saving ? <LoaderCircle className="animate-spin" /> : <Check />}</Button>{editing && <Button variant="ghost" size="icon" disabled={saving} aria-label="Cancelar edición" onClick={() => { setNoteDrafts(current => ({ ...current, [slot.id]: existingNote })); setEditingNoteId(null); }}><X /></Button>}</div> : <div className="admin-schedule-note-value"><span>{existingNote}</span><Button variant="ghost" size="icon" aria-label="Editar comentario" onClick={() => setEditingNoteId(slot.id)}><Pencil size={15} /></Button><Button variant="ghost" size="icon" disabled={slot.occupied} aria-label="Eliminar comentario" onClick={() => void saveSlot(slot, { internal_note: null })}><Trash2 size={15} /></Button></div>}</div>
          </article>;
        })}</div></section>)}
      </section>
    </div>

    <Dialog open={manualOpen} onOpenChange={open => { if (!open && savingId !== 'manual') setManualOpen(false); }}><DialogContent className="manual-dialog admin-schedule-dialog"><DialogTitle>Agregar horario</DialogTitle><DialogDescription>Elegí una fecha y un inicio entre 00:00 y 23:55, en intervalos de 5 minutos. La agenda pública conserva el horario comercial vigente.</DialogDescription><div className="admin-schedule-manual-fields">{profile.role === 'ADMIN' && <div><label htmlFor="schedule-manual-barber">Agenda</label><select id="schedule-manual-barber" className="select-control w-full" value={manualBarberId} onChange={event => setManualBarberId(event.target.value)}>{permittedRows.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></div>}<div><label htmlFor="schedule-manual-date">Fecha</label><Input id="schedule-manual-date" type="date" min={businessToday} max={manualEndDate} value={manualDate} onChange={event => setManualDate(event.target.value)} /></div><div className="admin-schedule-time-pair"><div><label htmlFor="schedule-manual-hour">Hora</label><select id="schedule-manual-hour" className="select-control w-full" value={manualHour} onChange={event => setManualHour(event.target.value)}>{hours.map(hour => <option key={hour} value={String(hour)}>{String(hour).padStart(2, '0')}</option>)}</select></div><span>:</span><div><label htmlFor="schedule-manual-minute">Minutos</label><select id="schedule-manual-minute" className="select-control w-full" value={manualMinute} onChange={event => setManualMinute(event.target.value)}>{manualMinutes.map(minute => <option key={minute} value={String(minute).padStart(2, '0')}>{String(minute).padStart(2, '0')}</option>)}</select></div></div></div><p className="manual-dialog-date text-xs text-muted-foreground">La fecha debe ser un día de atención entre {businessToday} y {manualEndDate}. Domingos cerrados.</p><DialogFooter className="manual-dialog-footer"><Button variant="outline" disabled={savingId === 'manual'} onClick={() => setManualOpen(false)}>Cancelar</Button><Button className="action-positive" disabled={savingId === 'manual' || !manualBarberId} onClick={() => void saveManualSlot()}>Guardar horario</Button></DialogFooter></DialogContent></Dialog>
  </main>;
}
