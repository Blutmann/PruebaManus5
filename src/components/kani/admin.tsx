import { useEffect, useMemo, useState } from 'react';
import { Ban, Bell, CalendarDays, Check, CircleDot, Clock3, Mail, MailOpen, MessageSquareText, SlidersHorizontal, X, XCircle } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { dateLabel, demoToday, serviceFor, type Barber } from '@/lib/kani-model';
import { useAdminStaff } from '@/lib/kani-admin-context';
import { permittedBarberNames } from '@/lib/kani-role-scope';
import { appointmentErrorMessage, readRealAppointments, retryRealAppointmentNotification, updateRealAppointmentStatus, type RealAppointment } from '@/lib/kani-appointments';
import { markAllAdminActivityNotificationsRead, readAdminActivityNotifications, setAdminActivityNotificationRead, type AdminActivityEvent } from '@/lib/kani-admin-activity';
import { AdminAvailability } from './availability-admin';

type View = 'upcoming' | 'pending' | 'cancelled' | 'availability';

const statusLabels = { PENDING: 'Pendiente', CONFIRMED: 'Confirmado', CANCELLED: 'Cancelado', COMPLETED: 'Completado' } as const;
type AdminNotification = { id: string; type: 'availability' | 'appointment' | 'info'; message: string; time: string; readAt: string | null };

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
  const [recentNotifications, setRecentNotifications] = useState<AdminNotification[]>([]);
  const unreadNotifications = recentNotifications.filter(notification => !notification.readAt);

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
  useEffect(() => {
    if (profile.role !== 'ADMIN') {
      setRecentNotifications([]);
      return;
    }
    let cancelled = false;
    void readAdminActivityNotifications()
      .then(events => { if (!cancelled) setRecentNotifications(events.map(toAdminNotification)); })
      .catch(cause => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'No se pudieron cargar las novedades.'); });
    return () => { cancelled = true; };
  }, [profile.role]);

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
  const listStatus = view === 'pending' ? 'PENDING' : view === 'cancelled' ? 'CANCELLED' : 'CONFIRMED';
  const list = appointments
    .filter(a => a.statusCode === listStatus)
    .filter(a => (view === 'cancelled' || a.date >= demoToday) && isAppointmentVisible(a) && (!dateFilter || a.date === dateFilter))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const metricDates = new Set(appointments.filter(isAppointmentVisible).map(appointment => appointment.date));
  metricDates.add(dateFilter || demoToday);
  const metrics = [...metricDates].sort().map(metricDate => {
    const values = { requested: 0, confirmed: 0, pending: 0 };
    appointments.filter(appointment => isAppointmentVisible(appointment) && appointment.date === metricDate).forEach(appointment => {
      values.requested += 1;
      if (appointment.statusCode === 'CONFIRMED') values.confirmed += 1;
      if (appointment.statusCode === 'PENDING') values.pending += 1;
    });
    return [metricDate, values] as const;
  });
  const tabs = [
    { to: '/admin' as const, label: 'Confirmados', icon: Check, id: 'upcoming' as const },
    { to: '/admin/pendientes' as const, label: 'Pendientes', icon: Clock3, id: 'pending' as const },
    { to: '/admin/cancelados' as const, label: 'Cancelados', icon: Ban, id: 'cancelled' as const },
    { to: '/admin/disponibilidad' as const, label: 'Horarios', icon: CalendarDays, id: 'availability' as const },
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

  async function toggleNotificationRead(notification: AdminNotification) {
    const readAt = notification.readAt ? null : new Date().toISOString();
    try {
      await setAdminActivityNotificationRead(notification.id, readAt);
      setRecentNotifications(current => current.map(item => item.id === notification.id ? { ...item, readAt } : item));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo actualizar la notificación.');
    }
  }

  async function markAllNotificationsRead() {
    if (!unreadNotifications.length) return;
    try {
      await markAllAdminActivityNotificationsRead();
      const readAt = new Date().toISOString();
      setRecentNotifications(current => current.map(item => ({ ...item, readAt })));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron marcar las notificaciones.');
    }
  }

  const listTitle = view === 'pending' ? 'Pendientes' : view === 'cancelled' ? 'Cancelados' : 'Confirmados';

  return <main className="site-container admin-page">
    <div className="admin-heading"><div className="min-w-0"><span className="eyebrow">KANI / ADMINISTRACIÓN</span><h1 className="section-title">Gestión de turnos</h1></div><div className="admin-heading-actions"><Popover><PopoverTrigger asChild><Button variant="outline" size="icon" className={profile.role === 'ADMIN' ? 'notification-trigger' : 'hidden'} aria-label={unreadNotifications.length ? `${unreadNotifications.length} notificaciones sin leer` : 'Notificaciones'}><Bell />{unreadNotifications.length > 0 && <span className="notification-count" aria-label={`${unreadNotifications.length} sin leer`}>{unreadNotifications.length}</span>}</Button></PopoverTrigger><PopoverContent side="bottom" sideOffset={10} align="end" className="notification-popover"><div className="notification-header"><div><span className="eyebrow">ACTIVIDAD</span><h2 className="mt-1 text-lg">Notificaciones</h2><p className="notification-unread-summary">{unreadNotifications.length ? `${unreadNotifications.length} sin leer` : 'Todas leídas'}</p></div><Bell size={17} className="text-gold" aria-hidden="true" /></div>{unreadNotifications.length > 0 && <Button variant="ghost" className="notification-mark-all" onClick={() => void markAllNotificationsRead()}>Marcar todas como leídas</Button>}{recentNotifications.length === 0 ? <div className="notification-empty"><Bell size={24} /><p>No hay novedades recientes.</p></div> : <div className="notification-list">{recentNotifications.map(notification => <article key={notification.id} className={`notification-item ${notification.readAt ? 'is-read' : 'is-unread'}`}><span className={`notification-kind ${notification.type}`} aria-hidden="true">{notification.type === 'availability' ? <SlidersHorizontal size={13} /> : notification.type === 'appointment' ? <CalendarDays size={13} /> : <Bell size={13} />}</span><div className="notification-body"><p className="text-sm leading-relaxed">{notification.message}</p><div className="notification-meta"><time>{notification.time}</time><button type="button" className="notification-toggle" onClick={() => void toggleNotificationRead(notification)}>{notification.readAt ? <><Mail size={13} /> Marcar como no leída</> : <><MailOpen size={13} /> Marcar como leída</>}</button></div></div></article>)}</div>}</PopoverContent></Popover><span className="admin-date">{dateLabel(demoToday)}</span></div></div>
    <nav className="admin-tabs" aria-label="Secciones de administración">{tabs.map(tab => <Button key={tab.id} asChild variant="ghost" className={view === tab.id ? 'tab-current' : ''}><Link to={tab.to} activeOptions={{ exact: true }}><tab.icon size={17} /><span>{tab.label}</span>{tab.id === 'pending' && pendingCount > 0 && <span className="count-badge">{pendingCount}</span>}</Link></Button>)}</nav>
    {notice && <div role="status" className="notice"><Check size={16} />{notice}<Button size="icon" variant="ghost" className="ml-auto" aria-label="Cerrar aviso" onClick={() => setNotice('')}><X /></Button></div>}
    {error && <div role="alert" className="notice text-destructive"><X size={16} />{error}</div>}
    {view !== 'availability' ? <section className="py-9">
      <div className="admin-list-heading"><div className="min-w-0"><h2 className="text-2xl">{listTitle}<span className="ml-2 text-base text-muted-foreground">· {list.length.toString().padStart(2, '0')}</span></h2></div><div className="admin-list-controls flex flex-wrap items-center gap-3">
        <label className="sr-only" htmlFor="barber-filter">Filtrar por barbero</label>
        {profile.role === 'ADMIN' ? <select id="barber-filter" className="select-control" value={scopedBarberFilter} onChange={e => setBarberFilter(e.target.value as Barber | 'Todos')}><option value="Todos">Todos los barberos</option>{permittedBarbers.map(b => <option key={b}>{b}</option>)}</select> : <span className="select-control" aria-label="Barbero autorizado">{ownBarber ?? ''}</span>}
        <label className="sr-only" htmlFor="date-filter">Filtrar por fecha</label><Input id="date-filter" type="date" aria-label="Filtrar por fecha" min={view === 'cancelled' ? undefined : demoToday} className="h-11 w-auto" value={dateFilter} onChange={e => setDateFilter(e.target.value)} />{dateFilter && <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Quitar filtro de fecha" onClick={() => setDateFilter('')}><X /></Button>}
      </div></div>
      <div className="appointment-table-header"><span>FECHA Y HORA</span><span>CLIENTE / SERVICIO</span><span>BARBERO</span><span>ESTADO</span><span className="text-right">ACCIONES</span></div>
      <div className="appointment-list">{list.map(a => <article className="appointment-row" key={a.id}><div className="appointment-when"><span className="text-2xl">{a.time}</span><span className="mt-1 block text-xs capitalize text-muted-foreground">{dateLabel(a.date)}</span></div><div className="appointment-client"><h3 className="font-medium">{a.name}</h3><span className="mt-1 block text-sm text-muted-foreground">{serviceFor(a.service).name} <span className="mx-1">·</span> {serviceFor(a.service).duration} min</span>{a.notes && <Popover><PopoverTrigger asChild><button type="button" className="appointment-note mt-2" aria-label={`Ver observación de ${a.name}`}><MessageSquareText size={13} /> TURNO CON OBSERVACIONES</button></PopoverTrigger><PopoverContent align="start" className="note-popover"><span className="eyebrow">OBSERVACIÓN DEL CLIENTE</span><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{a.notes}</p></PopoverContent></Popover>}</div><span className="appointment-barber flex items-center gap-2 text-sm"><span className="small-avatar">{a.barber[0]}</span>{a.barber}</span><span className={`status ${a.statusCode === 'PENDING' ? 'pending' : a.statusCode === 'CONFIRMED' ? 'confirmed' : a.statusCode === 'CANCELLED' ? 'cancelled' : ''}`}>{a.statusCode === 'PENDING' ? <CircleDot size={12} /> : a.statusCode === 'CANCELLED' ? <XCircle size={12} /> : <Check size={12} />}{statusLabels[a.statusCode]}</span><div className="appointment-actions"><div className="appointment-actions-primary">{a.statusCode === 'PENDING' && <Button className="action-positive h-10" onClick={() => void changeStatus(a, 'CONFIRMED')}><Check />Confirmar</Button>}{a.statusCode !== 'CANCELLED' && a.statusCode !== 'COMPLETED' && <Button variant="outline" className="action-brand-outline h-10" onClick={() => setCancel(a)}><X /><span>Cancelar</span></Button>}</div>{a.statusCode !== 'COMPLETED' && <Button variant="outline" className="appointment-retry action-mail h-10" onClick={() => void retryEmail(a)}><Mail />Enviar mail</Button>}</div></article>)}</div>
      {loading && <div className="empty-state"><p className="text-sm text-muted-foreground">Cargando reservas reales…</p></div>}
      {!loading && list.length === 0 && <div className="empty-state"><CalendarDays size={32} /><h3 className="mt-4 text-lg">{view === 'cancelled' ? 'No hay turnos cancelados.' : view === 'pending' ? 'Todo al día.' : 'No hay turnos confirmados.'}</h3><p className="mt-2 text-sm text-muted-foreground">{view === 'cancelled' ? 'Las reservas canceladas aparecerán aquí como historial.' : 'Probá con otra fecha o barbero.'}</p></div>}
      {view === 'pending' && <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground"><CircleDot size={12} className="text-gold" />Los turnos pendientes mantienen el horario reservado hasta que sean confirmados o cancelados.</div>}
      <section className="admin-metrics mt-10" aria-labelledby="admin-metrics-title"><div className="mb-4"><span className="eyebrow">RESUMEN</span><h2 id="admin-metrics-title" className="mt-1 text-xl">ESTADÍSTICAS DE TURNOS</h2></div><div className="metric-table"><div className="metric-row metric-header"><span>FECHA</span><span>TURNOS SOLICITADOS</span><span>TURNOS CONFIRMADOS</span><span>TURNOS PENDIENTES</span></div>{metrics.map(([metricDate, values]) => <div className="metric-row" key={metricDate}><span className="capitalize">{dateLabel(metricDate)}</span><strong>{values.requested}</strong><strong>{values.confirmed}</strong><strong>{values.pending}</strong></div>)}</div></section>
    </section> : <AdminAvailability profile={profile} permittedRows={permittedRows} permittedBarbers={permittedBarbers} />}
    <Dialog open={Boolean(cancel)} onOpenChange={open => { if (!open) setCancel(null); }}><DialogContent className="max-w-[calc(100%-32px)] sm:max-w-md"><DialogTitle>¿Cancelar este turno?</DialogTitle><DialogDescription>{cancel?.name} · {cancel?.service}<br />{cancel && dateLabel(cancel.date)} · {cancel?.time}<br /><br />El horario volverá a estar disponible para reservar.</DialogDescription><DialogFooter><Button variant="outline" onClick={() => setCancel(null)}>Mantener turno</Button><Button className="action-brand" onClick={() => { if (!cancel || !isAppointmentVisible(cancel)) return; void changeStatus(cancel, 'CANCELLED'); setCancel(null); }}>Cancelar turno</Button></DialogFooter></DialogContent></Dialog>
  </main>;
}

function toAdminNotification(event: AdminActivityEvent): AdminNotification {
  const date = new Date(`${event.event_date}T12:00:00`).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const time = event.event_time?.slice(0, 5) ?? '--:--';
  const client = event.client_name ?? 'cliente';
  const message = event.event_type === 'AVAILABILITY_UNAVAILABLE'
    ? `${event.actor_display_name} marcó como NO DISPONIBLE el horario de ${time} hs del ${date}.`
    : event.event_type === 'AVAILABILITY_AVAILABLE'
      ? `${event.actor_display_name} marcó como DISPONIBLE el horario de ${time} hs del ${date}.`
      : event.event_type === 'APPOINTMENT_REQUESTED'
        ? `${client} solicitó un turno con ${event.barber_name} el ${date} a las ${time} hs.`
        : event.event_type === 'APPOINTMENT_CONFIRMED'
          ? `${event.actor_display_name} confirmó el turno de ${client} del ${date} a las ${time} hs.`
          : `${event.actor_display_name} canceló el turno de ${client} del ${date} a las ${time} hs.`;

  return {
    id: event.id,
    type: event.event_type.startsWith('AVAILABILITY') ? 'availability' : 'appointment',
    message,
    time: new Date(event.created_at).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
    readAt: event.read_at,
  };
}
