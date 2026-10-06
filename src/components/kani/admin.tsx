import { useEffect, useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { CalendarDays, Clock3, SlidersHorizontal, Check, X, CircleDot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useKani } from './store';
import { dateLabel, serviceFor, demoToday, type Appointment, type Barber } from '@/lib/kani-model';
import { useAdminStaff } from '@/lib/kani-admin-context';
import { permittedBarberNames } from '@/lib/kani-role-scope';
import { AdminAvailability } from './availability-admin';

type View = 'upcoming' | 'pending' | 'availability';

export function Admin({ view }: { view: View }) {
  const { profile, barbers: permittedRows } = useAdminStaff();
  const { appointments, setStatus } = useKani();
  const permittedBarbers = useMemo(
    () => permittedBarberNames(profile, permittedRows),
    [profile, permittedRows],
  );
  const firstPermittedBarber = permittedBarbers[0];
  const ownBarber: Barber | null = profile.role === 'BARBER' ? firstPermittedBarber ?? null : null;
  const [barberFilter, setBarberFilter] = useState<Barber | 'Todos'>('Todos');
  const [dateFilter, setDateFilter] = useState('');
  const [cancel, setCancel] = useState<Appointment | null>(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (profile.role === 'BARBER' && firstPermittedBarber) {
      setBarberFilter(firstPermittedBarber);
    }
  }, [profile.role, firstPermittedBarber]);

  if (!firstPermittedBarber) {
    return <main className="site-container admin-page"><div className="py-12 text-center text-destructive">No hay una agenda autorizada para este perfil.</div></main>;
  }

  const scopedBarberFilter: Barber | 'Todos' = profile.role === 'BARBER'
    ? firstPermittedBarber ?? 'Todos'
    : barberFilter === 'Todos' || permittedBarbers.includes(barberFilter) ? barberFilter : 'Todos';
  const isAppointmentVisible = (appointment: Appointment) => {
    if (profile.role === 'BARBER') return appointment.barber === ownBarber;
    return scopedBarberFilter === 'Todos' || appointment.barber === scopedBarberFilter;
  };
  const pendingCount = appointments.filter(a => a.status === 'Pendiente' && isAppointmentVisible(a)).length;
  const status = view === 'pending' ? 'Pendiente' : 'Confirmado';
  const list = appointments
    .filter(a => a.status === status && a.date >= demoToday && isAppointmentVisible(a) && (!dateFilter || a.date === dateFilter))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const tabs = [
    { to: '/admin' as const, label: 'Próximos turnos', icon: CalendarDays, id: 'upcoming' },
    { to: '/admin/pendientes' as const, label: 'Pendientes', icon: Clock3, id: 'pending' },
    { to: '/admin/disponibilidad' as const, label: 'Disponibilidad', icon: SlidersHorizontal, id: 'availability' },
  ];

  return <main className="site-container admin-page">
    <div className="admin-heading"><div className="min-w-0"><span className="eyebrow">KANI / ADMINISTRACIÓN</span><h1 className="section-title">Tu agenda, en orden.</h1><p className="mt-3 text-muted-foreground">Cada turno. Cada detalle. Todo en su lugar.</p></div><span className="admin-date">Martes 6 de octubre <span className="text-gold">2026</span></span></div>
    <nav className="admin-tabs" aria-label="Secciones de administración">{tabs.map(tab => <Button key={tab.id} asChild variant="ghost" className={view === tab.id ? 'tab-current' : ''}><Link to={tab.to} activeOptions={{ exact: true }}><tab.icon size={17} /><span>{tab.label}</span>{tab.id === 'pending' && pendingCount > 0 && <span className="count-badge">{pendingCount}</span>}</Link></Button>)}</nav>
    {notice && <div role="status" className="notice"><Check size={16} />{notice}<Button size="icon" variant="ghost" className="ml-auto" aria-label="Cerrar aviso" onClick={() => setNotice('')}><X /></Button></div>}
    {view !== 'availability' ? <section className="py-9">
      <div className="admin-list-heading"><div className="min-w-0"><h2 className="text-2xl">{view === 'pending' ? 'Pendientes de confirmar' : 'Próximos turnos'} <span className="ml-2 text-base text-muted-foreground">{list.length.toString().padStart(2, '0')}</span></h2><p className="mt-2 text-sm text-muted-foreground">{view === 'pending' ? 'Revisá las solicitudes y confirmá cada turno.' : 'Los próximos encuentros en el studio.'}</p></div><div className="flex flex-wrap gap-3">
        <label className="sr-only" htmlFor="barber-filter">Filtrar por barbero</label>
        {profile.role === 'ADMIN' ? <select id="barber-filter" className="select-control" value={scopedBarberFilter} onChange={e => setBarberFilter(e.target.value as Barber | 'Todos')}><option value="Todos">Todos los barberos</option>{permittedBarbers.map(b => <option key={b}>{b}</option>)}</select> : <span className="select-control" aria-label="Barbero autorizado">{ownBarber ?? ''}</span>}
        <label className="sr-only" htmlFor="date-filter">Filtrar por fecha</label><Input id="date-filter" type="date" aria-label="Filtrar por fecha" min={demoToday} className="h-11 w-auto" value={dateFilter} onChange={e => setDateFilter(e.target.value)} />{dateFilter && <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Quitar filtro de fecha" onClick={() => setDateFilter('')}><X /></Button>}
      </div></div>
      <div className="appointment-table-header"><span>FECHA Y HORA</span><span>CLIENTE / SERVICIO</span><span>BARBERO</span><span>ESTADO</span><span className="text-right">ACCIONES</span></div>
      <div className="appointment-list">{list.map(a => <article className="appointment-row" key={a.id}><div className="appointment-when"><span className="text-2xl">{a.time}</span><span className="mt-1 block text-xs capitalize text-muted-foreground">{dateLabel(a.date)}</span></div><div className="appointment-client"><h3 className="font-medium">{a.name}</h3><span className="mt-1 block text-sm text-muted-foreground">{serviceFor(a.service).name} <span className="mx-1">·</span> {serviceFor(a.service).duration} min</span></div><span className="appointment-barber flex items-center gap-2 text-sm"><span className="small-avatar">{a.barber[0]}</span>{a.barber}</span><span className={`status ${a.status === 'Pendiente' ? 'pending' : 'confirmed'}`}>{a.status === 'Pendiente' ? <CircleDot size={12} /> : <Check size={12} />}{a.status}</span><div className="appointment-actions">{view === 'pending' && <Button className="h-10" onClick={() => { setStatus(a.id, 'Confirmado'); setNotice(`Turno de ${a.name} confirmado.`); }}><Check />Confirmar</Button>}<Button variant="outline" className="h-10" onClick={() => setCancel(a)}><X /><span>Cancelar</span></Button></div></article>)}</div>
      {list.length === 0 && <div className="empty-state"><CalendarDays size={32} /><h3 className="mt-4 text-lg">{view === 'pending' ? 'Todo al día.' : 'No hay turnos para mostrar.'}</h3><p className="mt-2 text-sm text-muted-foreground">{view === 'pending' ? 'No tenés solicitudes pendientes con estos filtros.' : 'Probá con otra fecha o barbero.'}</p></div>}
      <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground"><CircleDot size={12} className="text-gold" />{view === 'pending' ? 'Las solicitudes pendientes mantienen el horario reservado.' : 'Solo se muestran reservas online confirmadas.'}</div>
    </section> : <AdminAvailability profile={profile} permittedRows={permittedRows} permittedBarbers={permittedBarbers} />}
    <Dialog open={Boolean(cancel)} onOpenChange={open => { if (!open) setCancel(null); }}><DialogContent className="max-w-[calc(100%-32px)] sm:max-w-md"><DialogTitle>¿Cancelar este turno?</DialogTitle><DialogDescription>{cancel?.name} · {cancel && serviceFor(cancel.service).name}<br />{cancel && dateLabel(cancel.date)} · {cancel?.time}<br /><br />El horario volverá a estar disponible para reservar.</DialogDescription><DialogFooter><Button variant="outline" onClick={() => setCancel(null)}>Mantener turno</Button><Button variant="destructive" onClick={() => { if (!cancel || !isAppointmentVisible(cancel)) return; setStatus(cancel.id, 'Cancelado'); setNotice(`Turno de ${cancel.name} cancelado. El horario está disponible nuevamente.`); setCancel(null); }}>Cancelar turno</Button></DialogFooter></DialogContent></Dialog>
  </main>;
}
