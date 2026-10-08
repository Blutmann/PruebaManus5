import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUpRight, Clock3, Instagram, MapPin, Scissors } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import kaniStudio from '@/assets/kani-studio.jpg';
import { money, services as fallbackServices } from '@/lib/kani-model';
import { supabase } from '@/integrations/supabase/client';

type HomeService = {
  name: string;
  duration_minutes: number;
  price_ars: number;
};

const localFallback: HomeService[] = fallbackServices.map(service => ({
  name: service.name,
  duration_minutes: service.duration,
  price_ars: service.price,
}));

export function Home() {
  const [catalog, setCatalog] = useState<HomeService[]>(localFallback);

  useEffect(() => {
    let mounted = true;

    void supabase
      .from('services')
      .select('name, duration_minutes, price_ars')
      .eq('active', true)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (mounted && data?.length) setCatalog(data);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <main className="home-page">
      <section className="home-hero" aria-labelledby="home-title">
        <img className="hero-image" src={kaniStudio} alt="Interior de KANI Barber Studio" />
        <div className="hero-shade" aria-hidden="true" />
        <div className="site-container hero-inner">
          <div className="hero-content">
            <span className="eyebrow">BARBER STUDIO · MARTÍNEZ</span>
            <h1 id="home-title">
              KANI
              <small>BARBER STUDIO</small>
            </h1>
            <p className="hero-tagline">Cortes precisos. Tiempo para vos.</p>
            <p className="hero-copy">Una barbería contemporánea para volver a sentirte vos.</p>
            <div className="hero-actions">
              <Button asChild className="action-positive h-12 px-6">
                <Link to="/reservar">Reservar turno <ArrowUpRight /></Link>
              </Button>
              <a className="home-secondary-link" href="#servicios">
                Ver servicios <ArrowDown size={15} />
              </a>
            </div>
          </div>
          <p className="hero-caption"><span className="hero-caption-line" /> SAN ISIDRO LABRADOR 7 · MARTÍNEZ</p>
        </div>
        <div className="hero-bottom">
          <div className="site-container flex items-center justify-between gap-4">
            <span>UN MOMENTO PARA VOS</span>
            <span className="hidden sm:inline">LUNES A SÁBADOS · 10:00 A 20:00 HS</span>
          </div>
        </div>
      </section>

      <section id="servicios" className="site-container services-section" aria-labelledby="services-title">
        <div className="services-heading">
          <div>
            <span className="eyebrow">SERVICIOS</span>
            <h2 id="services-title">Lo esencial, bien hecho.</h2>
          </div>
          <p className="max-w-xs text-right text-sm leading-relaxed text-muted-foreground sm:block">
            Elegí tu servicio y encontrá un horario que te quede cómodo.
          </p>
        </div>
        <div className="service-grid">
          {catalog.map((service, index) => (
            <article key={service.name} className="service-item">
              <span className="service-number">0{index + 1}</span>
              <div className="service-item-heading">
                <h3>{service.name}</h3>
                <Scissors size={17} aria-hidden="true" />
              </div>
              <div className="service-meta">
                <span><Clock3 size={14} /> {service.duration_minutes} min</span>
                <strong>{money(service.price_ars)}</strong>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="ubicacion" className="site-container home-location" aria-labelledby="location-title">
        <div className="home-location-grid">
          <div>
            <span className="eyebrow">DÓNDE ENCONTRARNOS</span>
            <h2 id="location-title">KANI BARBER STUDIO</h2>
            <p className="home-location-address">San Isidro Labrador 7<br />Martínez, Provincia de Buenos Aires</p>
          </div>
          <div className="home-location-details">
            <div>
              <span className="home-detail-label">HORARIOS</span>
              <p>Lunes a sábados<br />10:00 a 20:00 hs</p>
            </div>
            <div className="home-location-links">
              <a href="https://www.google.com/maps/place/KANI+BARBER+STUDIO/data=!4m2!3m1!1s0x0:0x48bcfe7b2ea7ba60" target="_blank" rel="noreferrer">
                <MapPin size={15} /> Cómo llegar <ArrowUpRight size={14} />
              </a>
              <a href="https://www.instagram.com/kanibarberstudio/" target="_blank" rel="noreferrer">
                <Instagram size={15} /> Instagram <ArrowUpRight size={14} />
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="site-container home-final-cta" aria-labelledby="final-cta-title">
        <div>
          <span className="eyebrow">TU PRÓXIMO TURNO</span>
          <h2 id="final-cta-title">Tu próximo corte empieza acá.</h2>
        </div>
        <Button asChild className="action-positive h-12 px-6">
          <Link to="/reservar">Reservar turno <ArrowUpRight /></Link>
        </Button>
      </section>
    </main>
  );
}
