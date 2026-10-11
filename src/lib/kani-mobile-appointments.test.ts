import { describe, expect, it } from 'vitest';
import type { RealAppointment } from './kani-appointments';
import { filterMobileAppointments } from './kani-mobile-appointments';

function appointment(overrides: Partial<RealAppointment>): RealAppointment {
  return {
    id: 'a-1',
    requestNumber: 1,
    service: 'corte',
    barber: 'Lautaro',
    date: '2026-10-10',
    time: '10:00',
    name: 'Cliente de prueba',
    email: 'test@example.com',
    phone: '1111111111',
    status: 'Pendiente',
    notes: '',
    statusCode: 'PENDING',
    barberId: 'barber-lautaro',
    serviceId: 'service-1',
    ...overrides,
  };
}

const adminOptions = {
  selectedDate: '',
  statusFilter: 'ALL' as const,
  barberFilter: 'Todos',
  role: 'ADMIN' as const,
  profileBarberId: null,
  permittedBarberIds: new Set(['barber-lautaro', 'barber-gonzalo']),
};

describe('filtro de turnos del panel móvil', () => {
  const appointments = [
    appointment({ id: 'pending', statusCode: 'PENDING', date: '2026-10-10', time: '12:00' }),
    appointment({ id: 'confirmed', statusCode: 'CONFIRMED', date: '2026-10-11', time: '10:00' }),
    appointment({ id: 'cancelled', statusCode: 'CANCELLED', date: '2026-10-11', time: '11:00' }),
    appointment({ id: 'completed', statusCode: 'COMPLETED', date: '2026-10-12', time: '09:00' }),
    appointment({ id: 'gonzalo', barber: 'Gonzalo', barberId: 'barber-gonzalo', date: '2026-10-10', time: '13:00' }),
  ];

  it('sin fecha inicial muestra los cuatro estados y fechas, incluyendo pendientes futuros', () => {
    expect(filterMobileAppointments(appointments, adminOptions).map(item => item.id)).toEqual([
      'pending', 'gonzalo', 'confirmed', 'cancelled', 'completed',
    ]);
  });

  it('aplica fecha y estado sin cambiar la representación de estados', () => {
    expect(filterMobileAppointments(appointments, { ...adminOptions, selectedDate: '2026-10-11', statusFilter: 'CONFIRMED' }).map(item => item.id)).toEqual(['confirmed']);
    expect(filterMobileAppointments(appointments, { ...adminOptions, selectedDate: '2026-10-11', statusFilter: 'CANCELLED' }).map(item => item.id)).toEqual(['cancelled']);
    expect(filterMobileAppointments(appointments, { ...adminOptions, statusFilter: 'COMPLETED' }).map(item => item.id)).toEqual(['completed']);
  });

  it('ADMIN puede filtrar por barbero y BARBER queda limitado a su barber_id', () => {
    expect(filterMobileAppointments(appointments, { ...adminOptions, barberFilter: 'Gonzalo' }).map(item => item.id)).toEqual(['gonzalo']);
    expect(filterMobileAppointments(appointments, {
      ...adminOptions,
      role: 'BARBER',
      profileBarberId: 'barber-lautaro',
      barberFilter: 'Todos',
    }).map(item => item.id)).toEqual(['pending', 'confirmed', 'cancelled', 'completed']);
  });
});
