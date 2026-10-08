import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, ArrowRight, Check, Clock3, Scissors, CalendarDays, UserRound, ChevronLeft, ChevronRight, CircleCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { services, barbers, serviceFor, money, demoToday, bookingEndDateFor, parseDate, isoDate, dateLabel, isBookingDate, minutes, type ServiceId, type Barber, type Appointment } from '@/lib/kani-model';
import { readPublicAvailabilitySlots, type PublicAvailabilitySlot } from '@/lib/kani-availability';
import { appointmentErrorMessage, createRealAppointment } from '@/lib/kani-appointments';
const steps = ['Servicio', 'Barbero', 'Fecha', 'Horario', 'Tus datos', 'Resumen'];
export function Booking() {
  const [step, setStep] = useState(0);
  const [service, setService] = useState<ServiceId | null>(null);
  const [barber, setBarber] = useState<Barber | null>(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [month, setMonth] = useState(parseDate(demoToday));
  const [contact, setContact] = useState({ name: '', email: '', phone: '', notes: '' });
  const [result, setResult] = useState<Appointment | null>(null);
  const [error, setError] = useState('');
  const [publicSlots, setPublicSlots] = useState<PublicAvailabilitySlot[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [clock, setClock] = useState(() => new Date());
  const formRef = useRef<HTMLFormElement>(null);
  const selected = service ? serviceFor(service) : null;
  const todayValue = isoDate(clock);
  const bookingEndValue = bookingEndDateFor(todayValue);
  const visibleSlots = useMemo(() => {
    if (!service || !date) return [];
    const duration = serviceFor(service).duration;
    return publicSlots
      .filter(slot => slot.slot_date === date && minutes(slot.end_time.slice(0, 5)) - minutes(slot.start_time.slice(0, 5)) >= duration)
      .filter(slot => slotCanStillBeBooked(slot.slot_date, slot.start_time, clock))
      .map(slot => ({ time: slot.start_time.slice(0, 5), status: slot.status }));
  }, [clock, date, publicSlots, service]);
  const slots = visibleSlots.filter(slot => slot.status === 'AVAILABLE').map(slot => slot.time);
  const availableDates = useMemo(() => {
    if (!service) return [];
    return [...new Set(publicSlots.filter(slot => slotsForDate(service, slot.slot_date, publicSlots, clock).length > 0).map(slot => slot.slot_date))].sort();
  }, [clock, publicSlots, service]);
  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    let cancelled = false;
    async function loadAvailability() {
      if (!barber) {
        setPublicSlots([]);
        setAvailabilityError('');
        return;
      }
      setAvailabilityLoading(true);
      setAvailabilityError('');
      try {
        const nextSlots = await readPublicAvailabilitySlots(barber, todayValue, bookingEndValue);
        if (!cancelled) setPublicSlots(nextSlots);
      } catch (cause) {
        if (!cancelled) {
          setPublicSlots([]);
          setAvailabilityError(cause instanceof Error ? cause.message : 'No se pudo consultar la disponibilidad.');
        }
      } finally {
        if (!cancelled) setAvailabilityLoading(false);
      }
    }
    void loadAvailability();
    return () => { cancelled = true; };
  }, [barber, bookingEndValue, todayValue]);
  useEffect(() => {
    if (!service || !barber || availabilityLoading) return;
    const todayHasSlots = availableDates.includes(todayValue);
    if (!todayHasSlots && (!date || date === todayValue)) {
      const nextDate = availableDates[0];
      if (nextDate && nextDate !== date) {
        setDate(nextDate);
        setTime('');
        setMonth(parseDate(nextDate));
      }
    }
  }, [availabilityLoading, availableDates, barber, date, service, todayValue]);
  function move(next: number) { setStep(next); setError(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function next() { if (step === 4 && !formRef.current?.reportValidity()) return; move(step + 1); }
  async function submit() {
    if (!service || !barber || !date || !time || submitting) return;
    setSubmitting(true);
    try {
      const created = await createRealAppointment({ barber, serviceName: serviceFor(service).name, date, time, name: contact.name.trim(), phone: contact.phone.trim(), email: contact.email.trim(), notes: contact.notes });
      setResult({ id: created.appointment_id, requestNumber: created.request_number, service, barber, date, time, name: contact.name.trim(), email: contact.email.trim(), phone: contact.phone.trim(), notes: contact.notes, status: 'Pendiente' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (cause) {
      setTime('');
      move(3);
      setError(appointmentErrorMessage(cause));
    } finally {
      setSubmitting(false);
    }
  }
  if (result) return (
    <main className="site-container confirmation">
      <div className="confirmation-mark"><Check size={30} /></div>
      <span className="eyebrow">TURNO PENDIENTE DE CONFIRMACIÓN</span>
      <h1>Turno pendiente de confirmación</h1>
      <p className="confirmation-lead text-muted-foreground">
        Tu solicitud fue registrada correctamente.<br />
        Te avisaremos por email cuando {result.barber} lo confirme.
      </p>
      <div className="confirmation-details">
        <div className="flex justify-between border-b pb-5">
          <span className="text-muted-foreground">Solicitud #{result.requestNumber}</span>
        </div>
        <dl className="summary-list">
          <div><dt>Servicio</dt><dd>{serviceFor(result.service).name}</dd></div>
          <div><dt>Barbero</dt><dd>{result.barber}</dd></div>
          <div><dt>Fecha</dt><dd className="capitalize">{dateLabel(result.date)}</dd></div>
          <div><dt>Horario</dt><dd>{result.time} · {serviceFor(result.service).duration} min</dd></div>
          <div><dt>A nombre de</dt><dd>{result.name}</dd></div>
          {result.notes?.trim() && <div><dt>Observaciones</dt><dd className="max-w-[65%] whitespace-pre-wrap">{result.notes.trim()}</dd></div>}
          <div><dt>Total</dt><dd>{money(serviceFor(result.service).price)}</dd></div>
        </dl>
      </div>
      <section className="confirmation-place border-t pt-7">
        <h2 className="text-sm font-medium">KANI BARBER STUDIO</h2>
        <p className="mt-3 text-sm text-muted-foreground">San Isidro Labrador 7<br />Martínez, Provincia de Buenos Aires</p>
        <p className="mt-3 text-sm text-muted-foreground">Lunes a sábados<br />10:00 a 20:00 hs</p>
      </section>
      <Button asChild variant="outline" className="confirmation-back mt-7 h-12 px-8">
        <a href="/">Volver al inicio <ArrowRight /></a>
      </Button>
    </main>
  );
  const titles = ['Elegí un servicio', 'Elegí un barbero', 'Elegí una fecha', 'Elegí un horario', 'Completá tus datos', 'Confirmá tu turno'];
  const subtitles = ['', '', '', '', '', ''];
  const canNext = [Boolean(service), Boolean(barber), Boolean(date), Boolean(time), true, true][step];
  const today = parseDate(todayValue);
  const lastBookingDay = parseDate(bookingEndValue);
  const timeGroups = [
    { label: 'Mañana', slots: visibleSlots.filter(slot => slot.time < '13:00') },
    { label: 'Tarde', slots: visibleSlots.filter(slot => slot.time >= '13:00') },
  ];
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const offset = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
  return <main className="site-container booking-page"><span className="brand-watermark" aria-hidden="true" /><Link to="/" className="back-link"><ArrowLeft size={15} /> Volver al inicio</Link><div className="booking-progress" aria-label={`Paso ${step + 1} de 6: ${steps[step]}`}>{steps.map((name, i) => <Button key={name} variant="ghost" disabled={i > step} aria-current={i === step ? 'step' : undefined} onClick={() => move(i)} className={i === step ? 'current' : i < step ? 'complete' : ''}><span>{i < step ? <Check size={13} /> : String(i + 1).padStart(2, '0')}</span><small>{name}</small></Button>)}</div><div className="booking-layout"><section className="min-w-0"><span className="eyebrow">TU PRÓXIMO TURNO / {String(step + 1).padStart(2, '0')}</span><h1 className="section-title">{titles[step]}</h1>{subtitles[step] && <p className="mb-8 mt-3 text-muted-foreground">{subtitles[step]}</p>}
    {step === 0 && <div className="space-y-3">{services.map(s => <Button key={s.id} variant="outline" aria-pressed={service === s.id} className={`booking-option ${service === s.id ? 'selected' : ''}`} onClick={() => { if (service !== s.id) { setService(s.id); setTime(''); if (date && slotsForDate(s.id, date, publicSlots).length === 0) setDate(''); } }}><span className="option-icon"><Scissors /></span><span className="min-w-0 flex-1 text-left"><span className="block text-lg font-medium">{s.name}</span><span className="mt-1 block text-sm text-muted-foreground">{s.duration} minutos</span></span><span className="text-base">{money(s.price)}</span><span className="selection-circle">{service === s.id && <Check size={12} />}</span></Button>)}</div>}
    {step === 1 && <div className="space-y-3">{barbers.map((b, i) => <Button key={b} variant="outline" aria-pressed={barber === b} className={`booking-option ${barber === b ? 'selected' : ''}`} onClick={() => { if (barber !== b) { setBarber(b); setDate(''); setTime(''); } }}><span className={`barber-avatar avatar-${i}`}>{b.charAt(0)}</span><span className="flex-1 text-left"><span className="block text-lg">{b}</span><span className="mt-1 block text-sm text-muted-foreground">KANI Barber Studio</span></span><span className="selection-circle">{barber === b && <Check size={12} />}</span></Button>)}</div>}
    {step === 2 && <div className="calendar-panel"><div className="mb-7 flex items-center justify-between"><h2 className="capitalize">{month.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}</h2><div className="flex gap-2"><Button variant="ghost" size="icon" aria-label="Mes anterior" disabled={month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth()} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft /></Button><Button variant="ghost" size="icon" aria-label="Mes siguiente" disabled={month.getFullYear() === lastBookingDay.getFullYear() && month.getMonth() === lastBookingDay.getMonth()} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight /></Button></div></div><div className="calendar-grid">{['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => <span key={i} className="calendar-weekday">{d}</span>)}{Array.from({ length: offset }, (_, i) => <span key={`blank-${i}`} />)}{Array.from({ length: daysInMonth }, (_, i) => { const day = new Date(month.getFullYear(), month.getMonth(), i + 1); const value = isoDate(day); const disabled = availabilityLoading || !service || !barber || !isBookingDate(value, todayValue, bookingEndValue) || slotsForDate(service, value, publicSlots, clock).length === 0; return <Button key={value} variant="ghost" className={`calendar-day ${date === value ? 'selected' : ''} ${value === todayValue ? 'today' : ''}`} disabled={disabled} aria-label={dateLabel(value)} aria-pressed={date === value} onClick={() => { if (date !== value) { setDate(value); setTime(''); } }}>{i + 1}</Button>; })}</div>{availabilityError && <p role="alert" className="mt-5 text-sm text-destructive">{availabilityError}</p>}<p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground"><span className="h-1 w-1 rounded-full bg-gold" /> Lunes a sábado · Próximos 21 días</p></div>}
    {step === 3 && <div><div className="mb-6 flex items-center gap-2 text-sm capitalize text-gold"><CalendarDays size={16} /> {dateLabel(date)}</div>{timeGroups.map(group => <div key={group.label} className="mb-6"><h2 className="mb-3 text-sm text-muted-foreground">{group.label}</h2><div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{group.slots.map(slot => <Button key={slot.time} variant="outline" disabled={slot.status !== 'AVAILABLE'} className={`booking-time-slot h-12 ${slot.status === 'UNAVAILABLE' ? 'time-unavailable' : ''} ${time === slot.time ? 'selected' : ''}`} aria-pressed={time === slot.time} aria-label={slot.status === 'UNAVAILABLE' ? `${slot.time}, no disponible` : slot.time} onClick={() => setTime(slot.time)}>{slot.time}{slot.status === 'UNAVAILABLE' && <span className="sr-only">No disponible</span>}</Button>)}</div></div>)}{availabilityError && <p role="alert" className="py-3 text-sm text-destructive">{availabilityError}</p>}{slots.length === 0 && !availabilityLoading && <p className="py-6 text-muted-foreground">No hay horarios disponibles. Elegí otra fecha.</p>}</div>}
    {step === 4 && <form ref={formRef} className="space-y-6" onSubmit={e => { e.preventDefault(); next(); }}><label className="field-label">Nombre y apellido<Input required minLength={3} autoComplete="name" value={contact.name} onChange={e => setContact({ ...contact, name: e.target.value })} placeholder="Tu nombre completo" /></label><label className="field-label">Celular<Input type="tel" required pattern="[+0-9 ()\-]{8,20}" autoComplete="tel" value={contact.phone} onChange={e => setContact({ ...contact, phone: e.target.value })} placeholder="11 1234 5678" /></label><label className="field-label">Email<Input type="email" required autoComplete="email" value={contact.email} onChange={e => setContact({ ...contact, email: e.target.value })} placeholder="nombre@email.com" /></label><label className="field-label">Observaciones <span className="text-xs font-normal text-muted-foreground">(opcional)</span><textarea className="notes-input" maxLength={500} value={contact.notes} onChange={e => setContact({ ...contact, notes: e.target.value })} placeholder="Algo que quieras contarnos" /></label><Button type="submit" hidden className="hidden" tabIndex={-1}>Continuar</Button></form>}
    {step === 5 && <div><div className="review-line"><UserRound size={20} /><div><h2>{contact.name}</h2><p className="mt-1 break-all text-sm text-muted-foreground">{contact.email}</p><p className="mt-1 text-sm text-muted-foreground">{contact.phone}</p></div><Button variant="ghost" className="ml-auto text-gold" onClick={() => move(4)}>Editar</Button></div><dl className="summary-list border-b py-5"><div><dt>Servicio</dt><dd>{selected?.name}</dd></div><div><dt>Barbero</dt><dd>{barber}</dd></div><div><dt>Fecha</dt><dd className="capitalize">{dateLabel(date)}</dd></div><div><dt>Horario</dt><dd>{time} · {selected?.duration} min</dd></div>{contact.notes.trim() && <div><dt>Observaciones</dt><dd className="max-w-[65%] whitespace-pre-wrap">{contact.notes.trim()}</dd></div>}<div><dt>Total</dt><dd className="text-xl">{selected && money(selected.price)}</dd></div></dl><div className="mt-6 flex items-start gap-3 text-sm text-muted-foreground"><Clock3 className="mt-0.5 shrink-0 text-gold" size={18} /><p>Tu solicitud quedará pendiente hasta que {barber} confirme el turno.</p></div></div>}
    {error && <p role="alert" className="mt-5 text-destructive">{error}</p>}<div className="booking-cta mt-8 flex items-center justify-between border-t pt-6"><Button variant="ghost" onClick={() => move(step - 1)} disabled={step === 0 || submitting}><ArrowLeft /> Atrás</Button><Button disabled={!canNext || submitting} className="action-positive h-12 px-6" onClick={step === 5 ? submit : next}>{step === 5 ? 'Solicitar turno' : 'Continuar'} <ArrowRight /></Button></div>
    </section><aside className="booking-aside"><span className="eyebrow">TU RESERVA</span><h2 className="mt-4 text-2xl">Un momento para vos.</h2><dl className="summary-list mt-6"><div><dt><Scissors size={16} /> Servicio</dt><dd>{selected?.name ?? 'Por elegir'}</dd></div><div><dt><UserRound size={16} /> Barbero</dt><dd>{barber ?? 'Por elegir'}</dd></div><div><dt><CalendarDays size={16} /> Fecha</dt><dd className="capitalize">{date ? parseDate(date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) : 'Por elegir'}</dd></div><div><dt><Clock3 size={16} /> Hora</dt><dd>{time || 'Por elegir'}</dd></div></dl>{selected && <div className="mt-6 flex items-center justify-between border-t pt-6"><span className="text-sm text-muted-foreground">{selected.duration} min</span><span className="text-xl">{money(selected.price)}</span></div>}<p className="mt-9 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><CircleCheck size={15} className="shrink-0 text-gold" /> Sin cuenta. Sin pagos online.<br />Solo tu próximo turno.</p></aside></div></main>;
}

function slotsForDate(service: ServiceId, date: string, publicSlots: PublicAvailabilitySlot[], now = new Date()) {
  const duration = serviceFor(service).duration;
  return publicSlots
    .filter(slot => slot.slot_date === date && slot.status === 'AVAILABLE' && minutes(slot.end_time.slice(0, 5)) - minutes(slot.start_time.slice(0, 5)) >= duration)
    .filter(slot => slotCanStillBeBooked(slot.slot_date, slot.start_time, now))
    .map(slot => slot.start_time.slice(0, 5));
}

function slotCanStillBeBooked(slotDate: string, startTime: string, now: Date) {
  return slotDate !== isoDate(now) || minutes(startTime.slice(0, 5)) > now.getHours() * 60 + now.getMinutes();
}
