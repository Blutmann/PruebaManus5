import { createFileRoute } from '@tanstack/react-router';
import { Admin } from '@/components/kani/admin';
import { pageHead } from '@/lib/kani-head';

export const Route = createFileRoute('/admin/cancelados')({
  head: () => pageHead('Turnos cancelados', 'Historial de reservas canceladas en KANI Barber Studio.'),
  component: () => <Admin view="cancelled" />,
});
