import { createFileRoute } from '@tanstack/react-router';
import { Booking } from '@/components/kani/booking';
import { pageHead } from '@/lib/kani-head';
export const Route = createFileRoute('/reservar')({ head: () => pageHead('Reservá tu turno', 'Elegí tu servicio, barbero y horario en KANI Barber Studio. Reservá sin crear una cuenta.'), component: Booking });
