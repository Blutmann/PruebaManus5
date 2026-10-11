import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, Check, ChevronRight, CircleDot, Clock3, Info, X, XCircle } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { dateLabel, demoToday, serviceFor } from '@/lib/kani-model';
import { useAdminStaff } from '@/lib/kani-admin-context';
import { appointmentErrorMessage, readRealAppointments, updateRealAppointmentStatus, type RealAppointment, type RealAppointmentStatus } from '@/lib/kani-appointments';
import { permittedBarberNames } from '@/lib/kani-role-scope';

type StatusFilter = 'ALL' | RealAppointmentStatus;

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

export function AdminMobileAppointments() {
  const { profile, barbers: permittedRows } = useAdminStaff();
  const permittedBarbers = useMemo(() => permittedBarberNames(profile, permittedRows), [profile, permittedRows]);
  const [appointments, setAppointments] = useState<RealAppointment[]>([]);
  const [selectedDate, setSelectedDate] = useState(demoToday);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [barberFilter, setBarberFilter] = useState('Todos');
  const [detailAppointment, setDetailAppointment] = useState<RealAppointment | null>(null);
  const [cancelTarget, setCancelTarget] = useState<RealAppointment | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

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

  const permittedBarberIds = useMemo(() => new Set(permittedRows.map(barber => barber.id)), [permittedRows]);
  const visibleAppointments = useMemo(() => appointments.filter(appointment => {
    if (!permittedBarberIds.has(appointment.barberId)) return false;
    if (profile.role === 'BARBER') return appointment.barberId === profile.barber_id;
    return barberFilter === 'Todos' || appointment.barber === barberFilter;
  }), [appointments, barberFilter, permittedBarberIds, profile.barber_id, profile.role]);
  const dayAppointments = useMemo(() => visibleAppointments
    .filter(appointment => appointment.date === selectedDate)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)), [selectedDate, visibleAppointments]);
  const filteredAppointments = useMemo(() => dayAppointments.filter(appointment => statusFilter === 'ALL' || appointment.statusCode === statusFilter), [dayAppointments, statusFilter]);
  const counts = useMemo(() => ({
    PENDING: dayAppointments.filter(appointment => appointment.statusCode === 'PENDING').length,
    CONFIRMED: dayAppointments.filter(appointment => appointment.statusCode === 'CONFIRMED').length,
    CANCELLED: dayAppointments.filter(appointment => appointment.statusCode === 'CANCELLED').length,
    COMPLETED: dayAppointments.filter(appointment => appointment.statusCode === 'COMPLETED').length,
  }), [dayAppointments]);

  async function changeStatus(appointment: RealAppointment, next: 'CONFIRMED' | 'CANCELLED' | 'COMPLETED') {
    setBusyId(appointment.id);
    try {
      await updateRealAppointmentStatus(appointment.id, next);
      await reload();
      setNotice(`Turno de ${appointment.name}: ${statusMeta[next].label.toLowerCase()}.`);
      setDetailAppointment(null);
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
          <p className="admin-mobile-date"><CalendarDays size={16} />{dateLabel(selectedDate)}</p>
        </div>
      </header>

      <section className="admin-mobile-summary" aria-label="Resumen de turnos">
        {(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'] as const).map(status => <button key={status} type="button" className={`admin-mobile-summary-card ${statusMeta[status].tone} ${statusFilter === status ? 'is-active' : ''}`} onClick={() => setStatusFilter(status)}><span>{statusMeta[status].label}</span><strong>{counts[status]}</strong></button>)}
      </section>

      <section className="admin-mobile-filters" aria-label="Filtros de agenda">
        <label htmlFor="mobile-date-filter">Fecha</label>
        <input id="mobile-date-filter" type="date" value={selectedDate} onChange={event => setSelectedDate(event.target.value)} />
        <label htmlFor="mobile-status-filter">Estado</label>
        <select id="mobile-status-filter" value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)}>{statusFilters.map(filter => <option key={filter.value} value={filter.value}>{filter.label}</option>)}</select>
        {profile.role === 'ADMIN' && <><label htmlFor="mobile-barber-filter">Barbero</label><select id="mobile-barber-filter" value={barberFilter} onChange={event => setBarberFilter(event.target.value)}><option value="Todos">Todos los barberos</option>{permittedBarbers.map(barber => <option key={barber} value={barber}>{barber}</option>)}</select></>}
      </section>

      {notice && <div role="status" className="admin-mobile-notice"><Check size={16} />{notice}<Button variant="ghost" size="icon" aria-label="Cerrar aviso" onClick={() => setNotice('')}><X /></Button></div>}
      {error && <div role="alert" className="admin-mobile-notice is-error"><XCircle size={16} />{error}</div>}

      <section className="admin-mobile-agenda" aria-labelledby="mobile-agenda-title">
        <div className="admin-mobile-section-heading"><div><span className="eyebrow">AGENDA DEL DÍA</span><h2 id="mobile-agenda-title">{filteredAppointments.length} {filteredAppointments.length === 1 ? 'turno' : 'turnos'}</h2></div><span className="text-sm text-muted-foreground">{statusFilter === 'ALL' ? 'Todos los estados' : statusMeta[statusFilter].label}</span></div>
        {loading && <div className="admin-mobile-empty"><Clock3 size={28} /><p>Cargando turnos…</p></div>}
        {!loading && filteredAppointments.length === 0 && <div className="admin-mobile-empty"><CalendarDays size={28} /><h3>No hay turnos para estos filtros.</h3><p>Probá con otra fecha o estado. Los turnos cancelados permanecen en el historial.</p></div>}
        <div className="admin-mobile-list">{filteredAppointments.map(appointment => <article className="admin-mobile-appointment" key={appointment.id}>
          <div className="admin-mobile-appointment-top"><div className="admin-mobile-time"><strong>{appointment.time}</strong><span>{dateLabel(appointment.date)}</span></div>{renderStatus(appointment.statusCode)}</div>
          <div className="admin-mobile-appointment-main"><h3>{appointment.name}</h3><p>{serviceFor(appointment.service).name} <span>·</span> {serviceFor(appointment.service).duration} min</p>{profile.role === 'ADMIN' && <span className="admin-mobile-barber">{appointment.barber}</span>}</div>
          <div className="admin-mobile-card-actions"><Button variant="outline" className="admin-mobile-detail" onClick={() => setDetailAppointment(appointment)}><Info size={16} />Ver detalle<ChevronRight size={16} /></Button>{appointment.statusCode === 'PENDING' && <><Button className="action-positive" disabled={busyId === appointment.id} onClick={() => void changeStatus(appointment, 'CONFIRMED')}><Check size={16} />Confirmar</Button><Button variant="outline" className="action-brand-outline" disabled={busyId === appointment.id} onClick={() => setCancelTarget(appointment)}><X size={16} />Rechazar</Button></>}{appointment.statusCode === 'CONFIRMED' && <><Button className="action-positive" disabled={busyId === appointment.id} onClick={() => void changeStatus(appointment, 'COMPLETED')}><Check size={16} />Completar</Button><Button variant="outline" className="action-brand-outline" disabled={busyId === appointment.id} onClick={() => setCancelTarget(appointment)}><X size={16} />Cancelar</Button></>}</div>
        </article>)}</div>
      </section>
    </div>

    <Dialog open={Boolean(detailAppointment)} onOpenChange={open => { if (!open) setDetailAppointment(null); }}>
      <DialogContent className="admin-mobile-dialog">{detailAppointment && <><DialogTitle>Detalle del turno</DialogTitle><DialogDescription>Información disponible para gestionar este turno.</DialogDescription><div className="admin-mobile-detail-grid"><div><span>Cliente</span><strong>{detailAppointment.name}</strong></div><div><span>Teléfono</span><strong>{detailAppointment.phone}</strong></div><div><span>Email</span><strong>{detailAppointment.email}</strong></div><div><span>Servicio</span><strong>{serviceFor(detailAppointment.service).name} · {serviceFor(detailAppointment.service).duration} min</strong></div><div><span>Barbero</span><strong>{detailAppointment.barber}</strong></div><div><span>Estado</span>{renderStatus(detailAppointment.statusCode)}</div>{detailAppointment.notes && <div className="admin-mobile-detail-notes"><span>Observaciones</span><p>{detailAppointment.notes}</p></div>}</div><DialogFooter>{detailAppointment.statusCode === 'PENDING' && <><Button className="action-positive" disabled={busyId === detailAppointment.id} onClick={() => void changeStatus(detailAppointment, 'CONFIRMED')}><Check size={16} />Confirmar</Button><Button variant="outline" className="action-brand-outline" disabled={busyId === detailAppointment.id} onClick={() => { setCancelTarget(detailAppointment); setDetailAppointment(null); }}><X size={16} />Rechazar</Button></>}{detailAppointment.statusCode === 'CONFIRMED' && <><Button className="action-positive" disabled={busyId === detailAppointment.id} onClick={() => void changeStatus(detailAppointment, 'COMPLETED')}><Check size={16} />Completar</Button><Button variant="outline" className="action-brand-outline" disabled={busyId === detailAppointment.id} onClick={() => { setCancelTarget(detailAppointment); setDetailAppointment(null); }}><X size={16} />Cancelar</Button></>}</DialogFooter></>}</DialogContent>
    </Dialog>

    <Dialog open={Boolean(cancelTarget)} onOpenChange={open => { if (!open) setCancelTarget(null); }}>
      <DialogContent className="admin-mobile-dialog"><DialogTitle>¿Cancelar este turno?</DialogTitle><DialogDescription>El turno quedará cancelado y seguirá disponible en el historial. Esta acción respeta la operación existente del sistema.</DialogDescription><DialogFooter><Button variant="outline" onClick={() => setCancelTarget(null)}>Volver</Button><Button className="action-brand" disabled={!cancelTarget || busyId === cancelTarget.id} onClick={() => cancelTarget && void changeStatus(cancelTarget, 'CANCELLED')}>Cancelar turno</Button></DialogFooter></DialogContent>
    </Dialog>
  </main>;
}
