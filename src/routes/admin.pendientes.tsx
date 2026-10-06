import { createFileRoute } from '@tanstack/react-router';
import { Admin } from '@/components/kani/admin';
import { pageHead } from '@/lib/kani-head';
export const Route = createFileRoute('/admin/pendientes')({ head: () => pageHead('Pendientes de confirmar', 'Revisión y confirmación de solicitudes de turnos en KANI Barber Studio.'), component: () => <Admin view="pending" /> });
