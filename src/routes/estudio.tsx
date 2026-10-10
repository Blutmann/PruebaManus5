import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Instagram, MapPin, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pageHead } from "@/lib/kani-head";

const mapsUrl =
  "https://www.google.com/maps/place/KANI+BARBER+STUDIO/data=!4m2!3m1!1s0x0:0x48bcfe7b2ea7ba60";
const instagramUrl = "https://www.instagram.com/kanibarberstudio/";

export const Route = createFileRoute("/estudio")({
  head: () =>
    pageHead(
      "Contacto",
      "Contacto de Kani Barber Studio, ubicación y horarios de atención.",
      "Kani Barber Studio - Contacto",
    ),
  component: StudioPage,
});

function StudioPage() {
  return (
    <main className="site-container studio-page">
      <div className="studio-page-header">
        <div>
          <p className="eyebrow">KANI BARBER STUDIO</p>
          <h1 className="section-title">Contacto</h1>
          <p className="studio-page-lead">
            Un espacio para bajar un cambio, cuidar tu estilo y sentirte vos.
          </p>
        </div>
        <Button asChild className="action-positive studio-booking-cta">
          <Link to="/reservar">
            Solicitar turno <ArrowRight />
          </Link>
        </Button>
      </div>
      <div className="studio-info-grid">
        <section className="studio-info-card">
          <MapPin className="studio-info-icon" size={22} />
          <div>
            <h2>Ubicación</h2>
            <p>
              San Isidro Labrador 7, Martínez<br />
              Provincia de Buenos Aires
            </p>
            <a href={mapsUrl} target="_blank" rel="noreferrer">
              Ver ubicación en Google Maps
            </a>
          </div>
        </section>
        <section className="studio-info-card">
          <Clock3 className="studio-info-icon" size={22} />
          <div>
            <h2>Horarios</h2>
            <p>
              Lunes a sábados
              <br />
              10:00 a 20:00 hs
            </p>
          </div>
        </section>
        <section className="studio-info-card">
          <Instagram className="studio-info-icon" size={22} />
          <div>
            <h2>Instagram</h2>
            <p>Seguinos en Instagram.</p>
            <a href={instagramUrl} target="_blank" rel="noreferrer">
              @kanibarberstudio
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
