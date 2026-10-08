import { createFileRoute } from '@tanstack/react-router';
import { Home } from '@/components/kani/home';
import { pageHead } from '@/lib/kani-head';

export const Route = createFileRoute('/')({
  head: () => pageHead('KANI Barber Studio', 'Barbería contemporánea en Martínez. Conocé nuestros servicios y reservá tu próximo turno.'),
  component: Home,
});
