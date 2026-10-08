import { createFileRoute } from '@tanstack/react-router';
import { Admin } from '@/components/kani/admin';
import { pageHead } from '@/lib/kani-head';
export const Route = createFileRoute('/admin/disponibilidad')({ head: () => pageHead('Horarios', 'Gestioná los horarios disponibles de KANI Barber Studio.'), component: () => <Admin view="availability" /> });
