import { useEffect, useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Bell, CalendarDays, Clock3, Mail, MessageSquareText, SlidersHorizontal, Check, X, CircleDot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { dateLabel, demoToday, serviceFor, type Barber } from '@/lib/kani-model';
import { useAdminStaff } from '@/lib/kani-admin-context';
import { permittedBarberNames } from '@/lib/kani-role-scope';
import { appointmentErrorMessage, readRealAppointments, retryRealAppointmentNotification, updateRealAppointmentStatus, type RealAppointment } from '@/lib/kani-appointments';
import { AdminAvailability } from './availability-admin';

type View = 'upcoming' | 'pending' | 'availability';

const statusLabels = { PENDING: 'Pendiente', CONFIRMED: 'Confirmado', CANCELLED: 'Cancelado', COMPLETED: 'Completado' } as const;
type AdminNotification = { id: string; type: 'availability' | 'appointment' | 'info'; message: string; time: string };

// Fuente aislada para la futura integración de eventos. No inventa novedades reales en producción.
const recentNotifications: AdminNotification[] = [];

export function Admin({ view }: { view: View }) {
  const { profile, barbers: permittedRows } = useAdminStaff();
  const permittedBarbers = useMemo(() => permittedBarberNames(profile, permittedRows), [profile, permittedRows]);
  const firstPermittedBarber = permittedBarbers[0];
  const ownBarber: Barber | null = profile.role === 'BARBER' ? firstPermittedBarber ?? null : null;
  const [barberFilter, setBarberFilter] = useState<Barber | 'Todos'>('Todos');
  const [dateFilter, setDateFilter] = useState('');
  const [cancel, setCancel] = useState<RealAppointment | null>(null);
  const [appointments, setAppointments] = useState<RealAppointment[]>([]);
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

  useEffect(() => {
    if (profile.role === 'BARBER' && firstPermittedBarber) setBarberFilter(firstPermittedBarber);
  }, [profile.role, firstPermittedBarber]);
  useEffect(() => { void reload(); }, []);

  if (!firstPermittedBarber) {
    return <main className="site-container admin-page"><div className="py-12 text-center text-destructive">No hay una agenda autorizada para este perfil.</div></main>;
  }

  const scopedBarberFilter: Barber | 'Todos' = profile.role === 'BARBER'
    ? firstPermittedBarber
    : barberFilter === 'Todos' || permittedBarbers.includes(barberFilter) ? barberFilter : 'Todos';
  const isAppointmentVisible = (appointment: RealAppointment) => {
    if (profile.role === 'BARBER') return appointment.barber === ownBarber;
    return scopedBarberFilter === 'Todos' || appointment.barber === scopedBarberFilter;
  };
  const pendingCount = appointments.filter(a => a.statusCode === 'PENDING' && isAppointmentVisible(a)).length;
  const list = appointments
    .filter(a => view === 'pending' ? a.statusCode === 'PENDING' : a.statusCode !== 'PENDING')
    .filter(a => a.date >= demoToday && isAppointmentVisible(a) && (!dateFilter || a.date === dateFilter))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const tabs = [
    { to: '/admin' as const, label: 'Próximos turnos', icon: CalendarDays, id: 'upcoming' },
    { to: '/admin/pendientes' as const, label: 'Pendientes', icon: Clock3, id: 'pending' },
    { to: '/admin/disponibilidad' as const, label: 'Disponibilidad', icon: SlidersHorizontal, id: 'availability' },
  ];

  async function changeStatus(appointment: RealAppointment, next: 'CONFIRMED' | 'CANCELLED' | 'COMPLETED') {
    try {
      await updateRealAppointmentStatus(appointment.id, next);
      await reload();
      setNotice(`Turno de ${appointment.name}: ${statusLabels[next].toLowerCase()}.`);
    } catch (cause) {
      setError(appointmentErrorMessage(cause));
    }
  }

  async function retryEmail(appointment: RealAppointment) {
    if (!isAppointmentVisible(appointment)) return;
    try {
      const status = await retryRealAppointmentNotification(appointment.id);
      setNotice(status === 'SENT' || status === 'ALREADY_SENT'
        ? 'Email enviado o ya procesado.'
        : status === 'FAILED' ? 'No se pudo enviar el email. El fallo quedó registrado para reintentar.'
          : 'No hay un email listo para reintentar.');
    } catch (cause) {
      setError(appointmentErrorMessage(cause));
    }
  }

  return <main className="site-container admin-page">
    <div className="admin-heading"><div className="min-w-0"><span className="eyebrow">KANI / ADMINISTRACIÓN</span><h1 className="section-title">Tu agenda, en orden.</h1><p className="mt-3 text-muted-foreground">Cada turno. Cada detalle. Todo en su lugar.</p></div><div className="admin-heading-actions"><Popover><PopoverTrigger asChild><Button variant="outline" size="icon" className="notification-trigger" aria-label={recentNotifications.length ? `${recentNotifications.length} novedades recientes` : 'Notificaciones'}><Bell />{recentNotifications.length > 0 && <span className="notification-dot" aria-hidden="true" />}</Button></PopoverTrigger><PopoverContent align="end" className="notification-popover"><div className="flex items-start justify-between gap-4 border-b pb-3"><div><span className="eyebrow">ACTIVIDAD</span><h2 className="mt-1 text-lg">Notificaciones</h2></div><Bell size={17} className="text-gold" aria-hidden="true" /></div>{recentNotifications.length === 0 ? <div className="notification-empty"><Bell size={24} /><p>No hay novedades recientes.</p></div> : <div className="notification-list">{recentNotifications.map(notification => <article key={notification.id} className="notification-item"><span className={`notification-kind ${notification.type}`} aria-hidden="true">{notification.type === 'availability' ? <SlidersHorizontal size={13} /> : notification.type === 'appointment' ? <CalendarDays size={13} /> : <Bell size={13} />}</span><div><p className="text-sm leading-relaxed">{notification.message}</p><time className="mt-1 block text-xs text-muted-foreground">{notification.time}</time></div></article>)}</div>}</PopoverContent></Popover><span className="admin-date">{dateLabel(demoToday)}</span></div></div>
    <nav className="admin-tabs" aria-label="Secciones de administración">{tabs.map(tab => <Button key={tab.id} asChild variant="ghost" className={view === tab.id ? 'tab-current' : ''}><Link to={tab.to} activeOptions={{ exact: true }}><tab.icon size={17} /><span>{tab.label}</span>{tab.id === 'pending' && pendingCount > 0 && <span className="count-badge">{pendingCount}</span>}</Link></Button>)}</nav>
    {notice && <div role="status" className="notice"><Check size={16} />{notice}<Button size="icon" variant="ghost" className="ml-auto" aria-label="Cerrar aviso" onClick={() => setNotice('')}><X /></Button></div>}
    {error && <div role="alert" className="notice text-destructive"><X size={16} />{error}</div>}
    {view !== 'availability' ? <section className="py-9">
      <div className="admin-list-heading"><div className="min-w-0"><h2 className="text-2xl">{view === 'pending' ? 'Pendientes de confirmar' : 'Próximos turnos'} <span className="ml-2 text-base text-muted-foreground">{list.length.toString().padStart(2, '0')}</span></h2><p className="mt-2 text-sm text-muted-foreground">{view === 'pending' ? 'Revisá las solicitudes y confirmá cada turno.' : 'Reservas reales de tus agendas.'}</p></div><div className="flex flex-wrap gap-3">
        <label className="sr-only" htmlFor="barber-filter">Filtrar por barbero</label>
        {profile.role === 'ADMIN' ? <select id="barber-filter" className="select-control" value={scopedBarberFilter} onChange={e => setBarberFilter(e.target.value as Barber | 'Todos')}><option value="Todos">Todos los barberos</option>{permittedBarbers.map(b => <option key={b}>{b}</option>)}</select> : <span className="select-control" aria-label="Barbero autorizado">{ownBarber ?? ''}</span>}
        <label className="sr-only" htmlFor="date-filter">Filtrar por fecha</label><Input id="date-filter" type="date" aria-label="Filtrar por fecha" min={demoToday} className="h-11 w-auto" value={dateFilter} onChange={e => setDateFilter(e.target.value)} />{dateFilter && <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Quitar filtro de fecha" onClick={() => setDateFilter('')}><X /></Button>}
      </div></div>
      <div className="appointment-table-header"><span>FECHA Y HORA</span><span>CLIENTE / SERVICIO</span><span>BARBERO</span><span>ESTADO</span><span className="text-right">ACCIONES</span></div>
      <div className="appointment-list">{list.map(a => <article className="appointment-row" key={a.id}><div className="appointment-when"><span className="text-2xl">{a.time}</span><span className="mt-1 block text-xs capitalize text-muted-foreground">{dateLabel(a.date)}</span></div><div className="appointment-client"><h3 className="font-medium">{a.name}</h3><span className="mt-1 block text-sm text-muted-foreground">{serviceFor(a.service).name} <span className="mx-1">·</span> {serviceFor(a.service).duration} min</span>{a.notes && <Popover><PopoverTrigger asChild><button type="button" className="appointment-note mt-2" aria-label={`Ver observación de ${a.name}`}><MessageSquareText size={13} /> TURNO CON OBSERVACIONES</button></PopoverTrigger><PopoverContent align="start" className="note-popover"><span className="eyebrow">OBSERVACIÓN DEL CLIENTE</span><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{a.notes}</p></PopoverContent></Popover>}</div><span className="appointment-barber flex items-center gap-2 text-sm"><span className="small-avatar">{a.barber[0]}</span>{a.barber}</span><span className={`status ${a.statusCode === 'PENDING' ? 'pending' : a.statusCode === 'CONFIRMED' ? 'confirmed' : ''}`}>{a.statusCode === 'PENDING' ? <CircleDot size={12} /> : <Check size={12} />}{statusLabels[a.statusCode]}</span><div className="appointment-actions">{a.statusCode === 'PENDING' && <Button className="h-10" onClick={() => void changeStatus(a, 'CONFIRMED')}><Check />Confirmar</Button>}{a.statusCode === 'CONFIRMED' && isValidEmail(a.email) && <Button asChild variant="outline" className="h-10"><a href={`mailto:${a.email}`} aria-label={`Enviar mail a ${a.name}`}><Mail /><span>Enviar mail</span></a></Button>}{a.statusCode !== 'CANCELLED' && a.statusCode !== 'COMPLETED' && <Button variant="outline" className="h-10" onClick={() => setCancel(a)}><X /><span>Cancelar</span></Button>}{a.statusCode !== 'COMPLETED' && <Button variant="ghost" className="h-10" onClick={() => void retryEmail(a)}>Reintentar email</Button>}</div></article>)}</div>
      {loading && <div className="empty-state"><p className="text-sm text-muted-foreground">Cargando reservas reales…</p></div>}
      {!loading && list.length === 0 && <div className="empty-state"><CalendarDays size={32} /><h3 className="mt-4 text-lg">{view === 'pending' ? 'Todo al día.' : 'No hay turnos para mostrar.'}</h3><p className="mt-2 text-sm text-muted-foreground">Probá con otra fecha o barbero.</p></div>}
      <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground"><CircleDot size={12} className="text-gold" />Las solicitudes PENDING mantienen el horario reservado.</div>
    </section> : <AdminAvailability profile={profile} permittedRows={permittedRows} permittedBarbers={permittedBarbers} />}
    <Dialog open={Boolean(cancel)} onOpenChange={open => { if (!open) setCancel(null); }}><DialogContent className="max-w-[calc(100%-32px)] sm:max-w-md"><DialogTitle>¿Cancelar este turno?</DialogTitle><DialogDescription>{cancel?.name} · {cancel?.service}<br />{cancel && dateLabel(cancel.date)} · {cancel?.time}<br /><br />El horario volverá a estar disponible para reservar.</DialogDescription><DialogFooter><Button variant="outline" onClick={() => setCancel(null)}>Mantener turno</Button><Button variant="destructive" onClick={() => { if (!cancel || !isAppointmentVisible(cancel)) return; void changeStatus(cancel, 'CANCELLED'); setCancel(null); }}>Cancelar turno</Button></DialogFooter></DialogContent></Dialog>
  </main>;
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
