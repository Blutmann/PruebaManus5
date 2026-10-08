import { createFileRoute } from '@tanstack/react-router';
import { Admin } from '@/components/kani/admin';
import { pageHead } from '@/lib/kani-head';
export const Route = createFileRoute('/admin/disponibilidad')({ head: () => pageHead('Horarios', 'Gestioná los horarios disponibles de Kani Barber Studio.', 'Kani Barber Studio - Panel de control'), component: () => <Admin view="availability" /> });
