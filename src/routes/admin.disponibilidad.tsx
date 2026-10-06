import { createFileRoute } from '@tanstack/react-router';
import { Admin } from '@/components/kani/admin';
import { pageHead } from '@/lib/kani-head';
export const Route = createFileRoute('/admin/disponibilidad')({ head: () => pageHead('Disponibilidad del equipo', 'Horarios semanales de Lautaro, Gonzalo y Valentín en KANI Barber Studio.'), component: () => <Admin view="availability" /> });
