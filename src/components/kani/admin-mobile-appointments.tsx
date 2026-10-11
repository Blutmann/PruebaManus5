import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowUp, CalendarDays, Check, CircleDot, Clock3, Mail, Phone, X, XCircle } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { dateLabel, money, serviceFor } from '@/lib/kani-model';
import { useAdminStaff } from '@/lib/kani-admin-context';
import { appointmentErrorMessage, readRealAppointments, updateRealAppointmentStatus, type RealAppointment, type RealAppointmentStatus } from '@/lib/kani-appointments';
import { businessDateToday, dateRangeForMobilePreset, filterMobileAppointments, mobileDatePresetLabels, type MobileDatePreset, type MobileStatusFilter } from '@/lib/kani-mobile-appointments';
import { permittedBarberNames } from '@/lib/kani-role-scope';
import { AdminActivityPopover } from '@/components/kani/admin-activity-popover';

type StatusFilter = MobileStatusFilter;

type StatusMeta = {
  label: string;
  tone: 'pending' | 'confirmed' | 'cancelled' | 'completed';
};

const statusMeta: Record<RealAppointmentStatus, StatusMeta> = {
  PENDING: { label: 'Pendiente', tone: 'pending' },
  CONFIRMED: { label: 'Confirmado', tone: 'confirmed' },
  CANCELLED: { label: 'Cancelado', tone: 'cancelled' },
  COMPLETED: { label: 'Completado', tone: 'completed' },
};

const statusFilters: Array<{ value: StatusFilter; label: string }> = [
  { value: 'ALL', label: 'Todos' },
  { value: 'PENDING', label: 'Pendientes' },
  { value: 'CONFIRMED', label: 'Confirmados' },
  { value: 'CANCELLED', label: 'Cancelados' },
  { value: 'COMPLETED', label: 'Completados' },
];

const summaryFilters = statusFilters.filter(filter => filter.value !== 'COMPLETED');

const datePresets: MobileDatePreset[] = ['ALL', 'TODAY', 'TOMORROW', 'NEXT_10_DAYS', 'THIS_WEEK', 'SPECIFIC'];

function statusTone(value: StatusFilter) {
  return value === 'ALL' ? 'all' : statusMeta[value].tone;
}

export function AdminMobileAppointments() {
  const { profile, barbers: permittedRows } = useAdminStaff();
  const permittedBarbers = useMemo(() => permittedBarberNames(profile, permittedRows), [profile, permittedRows]);
  const [appointments, setAppointments] = useState<RealAppointment[]>([]);
  const [datePreset, setDatePreset] = useState<MobileDatePreset>('ALL');
  const [specificDate, setSpecificDate] = useState('');
  const [businessToday, setBusinessToday] = useState(() => businessDateToday());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [barberFilter, setBarberFilter] = useState('Todos');
  const [cancelTarget, setCancelTarget] = useState<RealAppointment | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [showScrollTop, setShowScrollTop] = useState(false);

  async function reload() {
    setLoading(true);
    try {
      setAppointments(await readRealAppointments());
      setError('');
    } catch (cause) {
      setError(appointmentErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void reload(); }, []);
  useEffect(() => {
    if (profile.role === 'BARBER' && permittedBarbers[0]) setBarberFilter(permittedBarbers[0]);
  }, [profile.role, permittedBarbers]);
  useEffect(() => {
    const updateBusinessDate = () => {
      const next = businessDateToday();
      setBusinessToday(current => current === next ? current : next);
    };
    const interval = window.setInterval(updateBusinessDate, 60_000);
    return () => window.clearInterval(interval);
  }, []);
  useEffect(() => {
    const updateScrollState = () => setShowScrollTop(window.scrollY > 420);
    updateScrollState();
    window.addEventListener('scroll', updateScrollState, { passive: true });
    return () => window.removeEventListener('scroll', updateScrollState);
  }, []);

  const permittedBarberIds = useMemo(() => new Set(permittedRows.map(barber => barber.id)), [permittedRows]);
  const dateRange = useMemo(() => dateRangeForMobilePreset(datePreset, businessToday, specificDate), [businessToday, datePreset, specificDate]);
  const dayAppointments = useMemo(() => filterMobileAppointments(appointments, {
    dateRange,
    statusFilter: 'ALL',
    barberFilter,
    role: profile.role,
    profileBarberId: profile.barber_id,
    permittedBarberIds,
  }), [appointments, barberFilter, dateRange, permittedBarberIds, profile.barber_id, profile.role]);
  const filteredAppointments = useMemo(() => statusFilter === 'ALL'
    ? dayAppointments
    : dayAppointments.filter(appointment => appointment.statusCode === statusFilter), [dayAppointments, statusFilter]);
  const counts = useMemo(() => ({
    ALL: dayAppointments.length,
    PENDING: dayAppointments.filter(appointment => appointment.statusCode === 'PENDING').length,
    CONFIRMED: dayAppointments.filter(appointment => appointment.statusCode === 'CONFIRMED').length,
    CANCELLED: dayAppointments.filter(appointment => appointment.statusCode === 'CANCELLED').length,
    COMPLETED: dayAppointments.filter(appointment => appointment.statusCode === 'COMPLETED').length,
  }), [dayAppointments]);
  const activeDateLabel = datePreset === 'SPECIFIC' && specificDate ? dateLabel(specificDate) : mobileDatePresetLabels[datePreset];

  function selectDatePreset(next: MobileDatePreset) {
    if (next === 'SPECIFIC') setSpecificDate(current => current || businessToday);
    else setSpecificDate('');
    setDatePreset(next);
  }

  function selectSpecificDate(next: string) {
    setSpecificDate(next);
    setDatePreset(next ? 'SPECIFIC' : 'ALL');
  }

  async function changeStatus(appointment: RealAppointment, next: 'CONFIRMED' | 'CANCELLED' | 'COMPLETED') {
    setBusyId(appointment.id);
    try {
      await updateRealAppointmentStatus(appointment.id, next);
      await reload();
      setNotice(`Turno de ${appointment.name}: ${statusMeta[next].label.toLowerCase()}.`);
      setCancelTarget(null);
    } catch (cause) {
      setError(appointmentErrorMessage(cause));
    } finally {
      setBusyId(null);
    }
  }

  function renderStatus(status: RealAppointmentStatus) {
    const meta = statusMeta[status];
    const Icon = status === 'PENDING' ? CircleDot : status === 'CANCELLED' ? XCircle : Check;
    return <span className={`admin-mobile-status ${meta.tone}`}><Icon size={14} />{meta.label}</span>;
  }

  return <main className="site-container admin-mobile-page">
    <div className="admin-mobile-shell">
      <header className="admin-mobile-heading">
        <div>
          <Link to="/admin" className="admin-mobile-back"><ArrowLeft size={16} />Panel completo</Link>
          <span className="eyebrow">AGENDA MÓVIL</span>
          <h1 className="section-title">Turnos</h1>
          <p className="admin-mobile-date"><CalendarDays size={16} />{activeDateLabel}</p>
        </div>
        <AdminActivityPopover />
      </header>

      <section className="admin-mobile-summary" aria-label="Resumen de turnos">
        {summaryFilters.map(filter => <button key={filter.value} type="button" className={`admin-mobile-summary-card ${statusTone(filter.value)} ${statusFilter === filter.value ? 'is-active' : ''}`} aria-pressed={statusFilter === filter.value} onClick={() => setStatusFilter(filter.value)}><span>{filter.label}</span><strong>{counts[filter.value]}</strong></button>)}
      </section>

      <section className="admin-mobile-filters" aria-label="Filtros de agenda">
        <div className="admin-mobile-filter-field"><label htmlFor="mobile-date-preset">Período</label><select id="mobile-date-preset" value={datePreset} onChange={event => selectDatePreset(event.target.value as MobileDatePreset)} aria-label="Filtrar por período">{datePresets.map(preset => <option key={preset} value={preset}>{mobileDatePresetLabels[preset]}</option>)}</select></div>
        <div className="admin-mobile-filter-field"><label htmlFor="mobile-status-filter">Estado</label><select id="mobile-status-filter" value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)}>{statusFilters.map(filter => <option key={filter.value} value={filter.value}>{filter.label}</option>)}</select></div>
        <div className="admin-mobile-filter-field"><label htmlFor="mobile-barber-filter">Barbero</label>{profile.role === 'ADMIN' ? <select id="mobile-barber-filter" value={barberFilter} onChange={event => setBarberFilter(event.target.value)}><option value="Todos">Todos</option>{permittedBarbers.map(barber => <option key={barber} value={barber}>{barber}</option>)}</select> : <output id="mobile-barber-filter" className="admin-mobile-filter-readonly">{permittedBarbers[0] ?? 'Tu agenda'}</output>}</div>
        <div className="admin-mobile-filter-field"><label htmlFor="mobile-date-filter">Calendario</label><input id="mobile-date-filter" type="date" value={specificDate} onChange={event => selectSpecificDate(event.target.value)} aria-label="Elegir fecha específica" /></div>
      </section>

      {notice && <div role="status" className="admin-mobile-notice"><Check size={16} />{notice}<Button variant="ghost" size="icon" aria-label="Cerrar aviso" onClick={() => setNotice('')}><X /></Button></div>}
      {error && <div role="alert" className="admin-mobile-notice is-error"><XCircle size={16} />{error}</div>}

      <section className="admin-mobile-agenda" aria-labelledby="mobile-agenda-title">
        <div className="admin-mobile-section-heading"><div><span className="eyebrow">{datePreset === 'ALL' ? 'AGENDA' : 'AGENDA FILTRADA'}</span><h2 id="mobile-agenda-title">{filteredAppointments.length} {filteredAppointments.length === 1 ? 'turno' : 'turnos'}</h2></div><span className="text-sm text-muted-foreground">{statusFilter === 'ALL' ? 'Todos los estados' : statusMeta[statusFilter].label}</span></div>
        {loading && <div className="admin-mobile-empty"><Clock3 size={28} /><p>Cargando turnos…</p></div>}
        {!loading && filteredAppointments.length === 0 && <div className="admin-mobile-empty"><CalendarDays size={28} /><h3>No hay turnos para estos filtros.</h3><p>Probá con otro período, fecha o estado. Los turnos cancelados permanecen en el historial.</p></div>}
        <div className="admin-mobile-list">{filteredAppointments.map(appointment => {
          const fallbackService = serviceFor(appointment.service);
          const serviceName = appointment.serviceName ?? fallbackService.name;
          const serviceDuration = appointment.serviceDuration ?? fallbackService.duration;
          const phoneHref = appointment.phone.replace(/[^\d+]/g, '');
          return <article className="admin-mobile-appointment" key={appointment.id}>
            <div className="admin-mobile-appointment-top"><div className="admin-mobile-time"><strong>{appointment.time}</strong><span>hasta {appointment.endTime?.slice(0, 5) ?? '—'} · {dateLabel(appointment.date)}</span></div>{renderStatus(appointment.statusCode)}</div>
            <div className="admin-mobile-appointment-main"><h3>{appointment.name}</h3><div className="admin-mobile-appointment-details">
              <div><span>Servicio</span><strong>{serviceName} · {serviceDuration} min</strong></div>
              <div><span>Barbero</span><strong>{appointment.barber}</strong></div>
              <div><span>Celular</span><a href={`tel:${phoneHref}`}>{appointment.phone}</a></div>
              <div><span>Email</span><a href={`mailto:${appointment.email}`}>{appointment.email}</a></div>
              {appointment.servicePrice !== undefined && <div><span>Importe total</span><strong>{money(appointment.servicePrice)}</strong></div>}
              {appointment.notes?.trim() && <div className="admin-mobile-detail-notes"><span>Observaciones</span><p>{appointment.notes.trim()}</p></div>}
            </div></div>
            {(appointment.statusCode === 'PENDING' || appointment.statusCode === 'CONFIRMED') && <div className="admin-mobile-card-actions">{appointment.statusCode === 'PENDING' && <><Button className="action-positive" disabled={busyId === appointment.id} onClick={() => void changeStatus(appointment, 'CONFIRMED')}><Check size={16} />Confirmar</Button><Button variant="outline" className="action-brand-outline" disabled={busyId === appointment.id} onClick={() => setCancelTarget(appointment)}><X size={16} />Rechazar</Button></>}{appointment.statusCode === 'CONFIRMED' && <><Button className="action-positive" disabled={busyId === appointment.id} onClick={() => void changeStatus(appointment, 'COMPLETED')}><Check size={16} />Completar</Button><Button variant="outline" className="action-brand-outline" disabled={busyId === appointment.id} onClick={() => setCancelTarget(appointment)}><X size={16} />Cancelar</Button></>}</div>}
          </article>;
        })}</div>
      </section>
    </div>

    {showScrollTop && <Button type="button" variant="outline" size="icon" className="admin-mobile-scroll-top" aria-label="Volver arriba" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><ArrowUp size={17} /></Button>}

    <Dialog open={Boolean(cancelTarget)} onOpenChange={open => { if (!open) setCancelTarget(null); }}>
      <DialogContent className="admin-mobile-dialog"><DialogTitle>¿Cancelar este turno?</DialogTitle><DialogDescription>El turno quedará cancelado y seguirá disponible en el historial. Esta acción respeta la operación existente del sistema.</DialogDescription><DialogFooter><Button variant="outline" onClick={() => setCancelTarget(null)}>Volver</Button><Button className="action-brand" disabled={!cancelTarget || busyId === cancelTarget.id} onClick={() => cancelTarget && void changeStatus(cancelTarget, 'CANCELLED')}>Cancelar turno</Button></DialogFooter></DialogContent>
    </Dialog>
  </main>;
}
