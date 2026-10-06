import { createFileRoute } from '@tanstack/react-router';
import { Admin } from '@/components/kani/admin';
import { pageHead } from '@/lib/kani-head';
export const Route = createFileRoute('/admin/')({ head: () => pageHead('Próximos turnos', 'Agenda de reservas confirmadas del equipo de KANI Barber Studio.'), component: () => <Admin view="upcoming" /> });
