import { describe, expect, it } from 'vitest';
import { availableSlots, initialAvailability, initialAppointments, type Appointment } from './kani-model';
describe('KANI mock availability', () => {
 it('respects closing time for all service lengths', () => {
  const hours = initialAvailability();
  expect(availableSlots('corte', 'Gonzalo', '2026-10-08', [], hours).at(-1)).toBe('19:00');
  expect(availableSlots('corte-barba', 'Gonzalo', '2026-10-08', [], hours).at(-1)).toBe('19:00');
  expect(availableSlots('barba', 'Gonzalo', '2026-10-08', [], hours).at(-1)).toBe('19:00');
 });
 it('uses ten exact hourly start times for every service', () => {
  for (const service of ['corte', 'corte-barba', 'barba'] as const) {
   expect(availableSlots(service, 'Gonzalo', '2026-10-08', [], initialAvailability())).toEqual(Array.from({ length: 10 }, (_, i) => `${10+i}:00`));
  }
 });
 it('rounds modified opening hours up to the next exact hour', () => {
  const hours = initialAvailability();
  const thursday = hours.Gonzalo[4];
  if (thursday) thursday.start = '10:30';
  expect(availableSlots('barba', 'Gonzalo', '2026-10-08', [], hours)[0]).toBe('11:00');
 });
 it('blocks pending and confirmed overlapping intervals, but cancellation releases them', () => {
  const first = initialAppointments[0];
  if (!first) throw new Error('Missing sample');
  const a: Appointment = { ...first, status: 'Pendiente' };
  const hours = initialAvailability();
  expect(availableSlots('corte', 'Gonzalo', a.date, [a], hours)).not.toContain('19:00');
  expect(availableSlots('barba', 'Gonzalo', a.date, [a], hours)).not.toContain('19:00');
  expect(availableSlots('barba', 'Gonzalo', a.date, [{ ...a, status: 'Cancelado' }], hours)).toContain('19:00');
  expect(availableSlots('barba', 'Valentín', a.date, [a], hours)).toContain('19:00');
 });
 it('excludes Sundays, past dates and closed days', () => {
  const hours = initialAvailability();
  expect(availableSlots('corte', 'Lautaro', '2026-10-11', [], hours)).toEqual([]);
  expect(availableSlots('corte', 'Lautaro', '2026-10-05', [], hours)).toEqual([]);
  const tuesday = hours.Lautaro[2];
  if (tuesday) tuesday.enabled = false;
  expect(availableSlots('corte', 'Lautaro', '2026-10-06', [], hours)).toEqual([]);
 });
});
