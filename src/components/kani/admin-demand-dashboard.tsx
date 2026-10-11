import { Fragment, useEffect, useMemo, useState } from 'react';
import { BarChart3, CalendarRange, CheckCircle2, CircleDot, LockKeyhole, TrendingDown, TrendingUp } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { StaffBarber, StaffRole } from '@/lib/kani-auth';
import type { RealAppointment } from '@/lib/kani-appointments';
import { readDashboardAvailabilitySlots, type DashboardAvailabilitySlot } from '@/lib/kani-availability';
import {
  buildDailyDemand,
  buildOccupancyCells,
  comparisonPercent,
  DASHBOARD_DAYS,
  formatDelta,
  formatPercentage,
  getDashboardRange,
  hasComparableMetrics,
  getPreviousRange,
  filterAppointments,
  summarizeAppointments,
  type DashboardPeriod,
  type DashboardRange,
  type DashboardMetrics,
  type DashboardOccupancyCell,
} from '@/lib/kani-dashboard';
import { demoToday } from '@/lib/kani-model';

const periodOptions: Array<{ value: DashboardPeriod; label: string }> = [
  { value: 'week', label: 'Esta semana' },
  { value: '30days', label: 'Últimos 30 días' },
  { value: 'month', label: 'Este mes' },
  { value: 'custom', label: 'Rango personalizado' },
];

export function AdminDemandDashboard({
  appointments,
  loading,
  role,
  permittedRows,
}: {
  appointments: RealAppointment[];
  loading: boolean;
  role: StaffRole;
  permittedRows: StaffBarber[];
}) {
  const [period, setPeriod] = useState<DashboardPeriod>('week');
  const [customStart, setCustomStart] = useState(demoToday);
  const [customEnd, setCustomEnd] = useState(demoToday);
  const [barberFilter, setBarberFilter] = useState('Todos');
  const [availabilitySlots, setAvailabilitySlots] = useState<DashboardAvailabilitySlot[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState('');

  const range = useMemo(() => getDashboardRange(period, customStart, customEnd, demoToday), [period, customEnd, customStart]);
  const previousRange = useMemo(() => range ? getPreviousRange(range) : null, [range]);
  const permittedBarberIds = useMemo(() => new Set(permittedRows.map(row => row.id)), [permittedRows]);
  const selectedBarberRow = barberFilter === 'Todos' ? null : permittedRows.find(row => row.id === barberFilter) ?? null;
  const selectedBarber = selectedBarberRow?.name ?? null;
  const scopedAppointments = useMemo(() => {
    const allowedAppointments = appointments.filter(appointment => permittedBarberIds.has(appointment.barberId));
    const inRangeAppointments = filterAppointments(allowedAppointments, range ?? { startDate: '', endDate: '', label: '' });
    return selectedBarberRow ? inRangeAppointments.filter(appointment => appointment.barberId === selectedBarberRow.id) : inRangeAppointments;
  }, [appointments, permittedBarberIds, range, selectedBarberRow]);
  const metrics = useMemo(() => summarizeAppointments(scopedAppointments), [scopedAppointments]);
  const previousMetrics = useMemo(() => {
    if (!previousRange) return null;
    const allowedAppointments = appointments.filter(appointment => permittedBarberIds.has(appointment.barberId));
    const inRangeAppointments = filterAppointments(allowedAppointments, previousRange);
    return summarizeAppointments(selectedBarberRow ? inRangeAppointments.filter(appointment => appointment.barberId === selectedBarberRow.id) : inRangeAppointments);
  }, [appointments, permittedBarberIds, previousRange, selectedBarberRow]);
  const dailyDemand = useMemo(() => range ? buildDailyDemand(scopedAppointments, range) : [], [range, scopedAppointments]);
  const selectedBarberId = selectedBarberRow?.id ?? null;
  const scopedSlots = useMemo(() => availabilitySlots.filter(slot => permittedBarberIds.has(slot.barber_id) && (!selectedBarberId || slot.barber_id === selectedBarberId)), [availabilitySlots, permittedBarberIds, selectedBarberId]);
  const occupancy = useMemo(() => range ? buildOccupancyCells(scopedSlots, scopedAppointments, range) : { cells: [], timeRows: [] }, [range, scopedAppointments, scopedSlots]);

  const rangeStart = range?.startDate;
  const rangeEnd = range?.endDate;
  useEffect(() => {
    if (!rangeStart || !rangeEnd) {
      setAvailabilitySlots([]);
      return;
    }
    let active = true;
    setAvailabilityLoading(true);
    setAvailabilityError('');
    setAvailabilitySlots([]);
    void readDashboardAvailabilitySlots(rangeStart, rangeEnd)
      .then(rows => { if (active) setAvailabilitySlots(rows); })
      .catch(error => { if (active) setAvailabilityError(error instanceof Error ? error.message : 'No se pudo cargar la disponibilidad.'); })
      .finally(() => { if (active) setAvailabilityLoading(false); });
    return () => { active = false; };
  }, [rangeEnd, rangeStart]);

  useEffect(() => {
    if (role === 'BARBER') {
      setBarberFilter(permittedRows[0]?.id ?? 'Todos');
    } else {
      setBarberFilter('Todos');
    }
  }, [permittedRows, role]);

  const hasComparisonData = previousMetrics ? hasComparableMetrics(metrics, previousMetrics) : false;
  const cards = [
    { label: 'Turnos solicitados', value: metrics.requested, helper: 'Todas las solicitudes del período', delta: hasComparisonData ? formatDelta(comparisonPercent(metrics.requested, previousMetrics!.requested)) : null, icon: CalendarRange, tone: 'accent' },
    { label: 'Turnos confirmados', value: metrics.confirmed, helper: 'Estado confirmado', delta: hasComparisonData ? formatDelta(comparisonPercent(metrics.confirmed, previousMetrics!.confirmed)) : null, icon: CheckCircle2, tone: 'positive' },
    { label: 'Turnos pendientes', value: metrics.pending, helper: 'Aún requieren respuesta', delta: hasComparisonData ? formatDelta(comparisonPercent(metrics.pending, previousMetrics!.pending)) : null, icon: CircleDot, tone: 'accent' },
    { label: 'Turnos cancelados', value: metrics.cancelled, helper: 'Solicitudes canceladas', delta: hasComparisonData ? formatDelta(comparisonPercent(metrics.cancelled, previousMetrics!.cancelled)) : null, icon: TrendingDown, tone: 'warning' },
    { label: 'Tasa de confirmación', value: formatPercentage(metrics.confirmationRate), helper: 'Confirmados ÷ turnos resueltos', delta: hasComparisonData && metrics.confirmationRate !== null && previousMetrics!.confirmationRate !== null ? formatRateDelta(metrics.confirmationRate, previousMetrics!.confirmationRate) : null, icon: TrendingUp, tone: 'positive' },
  ] as const;

  const cellByKey = new Map(occupancy.cells.map(cell => [cell.key, cell]));
  const opportunityText = !availabilityLoading && !availabilityError ? getOpportunityText(dailyDemand, occupancy.cells, metrics) : '';

  return <section className="demand-dashboard" aria-labelledby="admin-metrics-title">
    <div className="demand-dashboard-heading">
      <div>
        <span className="eyebrow">RESUMEN</span>
        <h2 id="admin-metrics-title" className="mt-1 text-xl">Estadísticas de turnos</h2>
        <p>Una lectura rápida de la demanda real y de la capacidad registrada. Los porcentajes usan únicamente turnos persistidos.</p>
      </div>
      <div className="demand-dashboard-controls">
        <label htmlFor="dashboard-period">Período</label>
        <select id="dashboard-period" className="select-control" value={period} onChange={event => setPeriod(event.target.value as DashboardPeriod)}>{periodOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
        {role === 'ADMIN' ? <><label htmlFor="dashboard-barber">Barbero</label><select id="dashboard-barber" className="select-control" value={barberFilter} onChange={event => setBarberFilter(event.target.value)}><option value="Todos">Todos</option>{permittedRows.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></> : <span className="select-control" aria-label="Barbero autorizado">{permittedRows[0]?.name ?? 'Mi agenda'}</span>}
      </div>
    </div>
    {period === 'custom' && <div className="demand-custom-range" aria-label="Rango personalizado">
      <label htmlFor="dashboard-start">Desde</label><input id="dashboard-start" type="date" value={customStart} onChange={event => setCustomStart(event.target.value)} />
      <span>—</span>
      <label htmlFor="dashboard-end">Hasta</label><input id="dashboard-end" type="date" value={customEnd} onChange={event => setCustomEnd(event.target.value)} />
    </div>}
    {!range ? <div className="demand-chart-empty mt-5"><strong>Elegí un rango válido</strong><span>La fecha inicial debe ser anterior o igual a la fecha final.</span></div> : <>
      <p className="demand-filter-note mt-4">{range.label}{selectedBarber ? ` · Agenda de ${selectedBarber}` : ' · Todas las agendas autorizadas'}</p>
      <div className="demand-kpi-grid mt-4">{cards.map(card => <article key={card.label} className={`demand-kpi-card is-${card.tone}`}><div className="flex items-start justify-between gap-3"><span className="demand-kpi-label">{card.label}</span><card.icon size={16} aria-hidden="true" /></div><strong>{loading ? '—' : card.value}</strong><div className="demand-kpi-helper">{card.helper}{card.delta && <span className="demand-kpi-delta">{card.delta}</span>}</div></article>)}</div>
      <div className="demand-dashboard-grid">
        <article className="demand-chart-card" aria-labelledby="weekly-demand-title"><h3 id="weekly-demand-title">Demanda por día</h3><p>Solicitudes y confirmaciones dentro del período seleccionado, agrupadas de lunes a sábado.</p>{metrics.requested === 0 ? <div className="demand-chart-empty"><BarChart3 size={28} /><div><strong>No hay turnos reales en este período.</strong><span>El gráfico se actualizará cuando ingresen solicitudes.</span></div></div> : <div className="demand-chart-shell"><ResponsiveContainer width="100%" height="100%"><BarChart data={dailyDemand} margin={{ top: 8, right: 6, left: -18, bottom: 0 }}><CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} /><YAxis allowDecimals={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', color: 'var(--foreground)', fontFamily: 'Zen Antique' }} cursor={{ fill: 'color-mix(in oklch, var(--gold) 7%, transparent)' }} /><Legend wrapperStyle={{ color: 'var(--muted-foreground)', fontSize: 11 }} /><Bar dataKey="requested" name="Solicitados" fill="var(--gold)" radius={[3, 3, 0, 0]} /><Bar dataKey="confirmed" name="Confirmados" fill="var(--success)" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div>}<div className="demand-legend"><span className="demand-legend-item"><span className="demand-legend-dot pending" />Solicitados</span><span className="demand-legend-item"><span className="demand-legend-dot confirmed" />Confirmados</span></div></article>
        <article className="demand-chart-card" aria-labelledby="occupancy-title"><h3 id="occupancy-title">Ocupación y oportunidades</h3><p>Slots registrados por día y franja. Un horario bloqueado no se interpreta como falta de demanda.</p>{availabilityError ? <div role="alert" className="demand-chart-empty"><strong>No se pudo cargar la disponibilidad.</strong><span>{availabilityError}</span></div> : availabilityLoading ? <div className="demand-chart-empty"><span>Cargando capacidad registrada…</span></div> : occupancy.timeRows.length === 0 ? <div className="demand-chart-empty"><LockKeyhole size={28} /><div><strong>No hay slots registrados en este período.</strong><span>La grilla aparecerá cuando exista disponibilidad persistida.</span></div></div> : <><div className="demand-heatmap-wrap"><div className="demand-heatmap" role="table" aria-label="Ocupación por día y franja horaria"><div className="demand-heatmap-header" role="columnheader">Hora</div>{DASHBOARD_DAYS.map(day => <div className="demand-heatmap-header" role="columnheader" key={day.key}>{day.label}</div>)}{occupancy.timeRows.map(time => <Fragment key={time}><div className="demand-heatmap-time" role="rowheader">{time}</div>{DASHBOARD_DAYS.map(day => <HeatmapCell key={`${day.key}-${time}`} cell={cellByKey.get(`${day.key}-${time}`)} />)}</Fragment>)}</div></div><div className="demand-legend"><span className="demand-legend-item"><span className="demand-legend-dot confirmed" />Confirmado</span><span className="demand-legend-item"><span className="demand-legend-dot pending" />Pendiente</span><span className="demand-legend-item"><span className="demand-legend-dot available" />Disponible</span><span className="demand-legend-item"><span className="demand-legend-dot unavailable" />Bloqueado</span></div></>}{opportunityText && <div className="demand-opportunity"><strong>Lectura potencial: </strong>{opportunityText}</div>}</article>
      </div>
    </>}
  </section>;
}

function HeatmapCell({ cell }: { cell: DashboardOccupancyCell | undefined }) {
  if (!cell || cell.total === 0) return <div className="demand-heatmap-cell" role="cell" aria-label="Sin slots registrados"><small>—</small></div>;
  const tone = cell.confirmed ? 'has-confirmed' : cell.pending ? 'has-pending' : cell.unavailable ? 'has-unavailable' : '';
  return <div className={`demand-heatmap-cell ${tone}`} role="cell" aria-label={`${cell.dayLabel} ${cell.time}: ${cell.confirmed} confirmados, ${cell.pending} pendientes, ${cell.available} disponibles y ${cell.unavailable} bloqueados`} title={`${cell.dayLabel} ${cell.time}`}><strong>{cell.total}</strong><div className="demand-heatmap-counts"><span className="confirmed">C {cell.confirmed}</span><span className="pending">P {cell.pending}</span><span className="available">D {cell.available}</span><span className="unavailable">B {cell.unavailable}</span></div></div>;
}

function getOpportunityText(dailyDemand: ReturnType<typeof buildDailyDemand>, cells: DashboardOccupancyCell[], metrics: DashboardMetrics) {
  const daysWithCapacity = dailyDemand.filter(day => cells.some(cell => cell.dayKey === day.key && cell.available > 0));
  if (!daysWithCapacity.length) return 'No hay capacidad libre registrada para sugerir oportunidades en este período.';
  const daysWithConfirmed = daysWithCapacity.filter(day => day.confirmed > 0);
  if (!daysWithConfirmed.length) return 'Todavía no hay confirmaciones reales en este período; la grilla muestra la capacidad registrada sin concluir sobre la demanda.';
  const highest = Math.max(...daysWithCapacity.map(day => day.confirmed));
  const lowestDays = daysWithCapacity.filter(day => day.confirmed === Math.min(...daysWithCapacity.map(day => day.confirmed)) && day.confirmed < highest);
  if (!lowestDays.length) return `Hay ${metrics.confirmed} turnos confirmados distribuidos sin una diferencia clara entre días.`;
  return `${lowestDays.map(day => day.fullLabel).join(' y ')} concentran la menor cantidad de confirmaciones; podrían evaluarse acciones comerciales, sin que esto sea una conclusión definitiva.`;
}

function formatRateDelta(current: number, previous: number) {
  const points = Math.round((current - previous) * 100);
  return `${points > 0 ? '+' : ''}${points} pp vs. período anterior`;
}
