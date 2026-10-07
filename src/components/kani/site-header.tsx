import { Link, useRouterState } from '@tanstack/react-router';
import { ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import kaniLogo from '@/assets/kani-logo.webp';

export function Wordmark() {
  return <img src={kaniLogo} alt="KANI Barber Studio" width={2048} height={890} className="wordmark-img" />;
}

export function SiteHeader() {
  const path = useRouterState({ select: s => s.location.pathname });
  const admin = path.startsWith('/admin');
  return <header className="site-header"><div className="site-container grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4"><Link to="/" aria-label="KANI Barber Studio, inicio" className="w-fit"><Wordmark /></Link><nav className="flex shrink-0 items-center gap-4 sm:gap-8" aria-label="Navegación principal"><Link to={admin ? '/' : '/admin'} className="text-xs text-muted-foreground transition-colors hover:text-foreground sm:text-sm">{admin ? 'Volver al studio' : 'Administración'}</Link>{!admin && <Button asChild className="h-10 px-4 sm:px-5"><Link to="/reservar">Reservar <ArrowUpRight /></Link></Button>}</nav></div></header>;
}

export function SiteFooter() { return <footer className="site-container site-footer flex flex-col gap-3 border-t py-7 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span>© 2026 KANI Barber Studio</span><span>Zona Norte, Buenos Aires <span className="mx-2 text-gold">/</span> Lunes a sábado · 10:00–20:00 hs</span></footer>; }
