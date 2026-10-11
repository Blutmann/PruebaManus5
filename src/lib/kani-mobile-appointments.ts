import type { RealAppointment, RealAppointmentStatus } from './kani-appointments';

export type MobileStatusFilter = 'ALL' | RealAppointmentStatus;

type MobileAppointmentFilterOptions = {
  selectedDate: string;
  statusFilter: MobileStatusFilter;
  barberFilter: string;
  role: 'ADMIN' | 'BARBER';
  profileBarberId: string | null;
  permittedBarberIds: ReadonlySet<string>;
};

/**
 * Aplica el alcance del panel móvil sin imponer una fecha inicial.
 * Una fecha vacía significa "todas las fechas", equivalente a abrir el
 * panel original sin completar su filtro de fecha.
 */
export function filterMobileAppointments(
  appointments: RealAppointment[],
  options: MobileAppointmentFilterOptions,
) {
  return appointments
    .filter(appointment => {
      if (!options.permittedBarberIds.has(appointment.barberId)) return false;
      if (options.role === 'BARBER') return appointment.barberId === options.profileBarberId;
      return options.barberFilter === 'Todos' || appointment.barber === options.barberFilter;
    })
    .filter(appointment => !options.selectedDate || appointment.date === options.selectedDate)
    .filter(appointment => options.statusFilter === 'ALL' || appointment.statusCode === options.statusFilter)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}
