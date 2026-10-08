import { Link, useRouterState } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { ArrowUpRight, Instagram, LogOut, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import kaniLogo from '@/assets/kani-logo.webp';
import { getAuthenticatedStaff, signOut, type AuthenticatedStaff } from '@/lib/kani-auth';

export function Wordmark() {
  return <img src={kaniLogo} alt="Kani Barber Studio" width={2048} height={890} className="wordmark-img" />;
}

export function SiteHeader() {
  const path = useRouterState({ select: s => s.location.pathname });
  const admin = path.startsWith('/admin');
  const [staff, setStaff] = useState<AuthenticatedStaff | null>(null);
  useEffect(() => {
    if (!admin) return;
    let cancelled = false;
    void getAuthenticatedStaff().then(next => { if (!cancelled) setStaff(next); });
    return () => { cancelled = true; };
  }, [admin]);
  return <header className="site-header"><div className="site-container grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4"><div className="admin-header-left"><Link to="/" aria-label="Kani Barber Studio, inicio" className="w-fit"><Wordmark /></Link>{admin && <Button asChild variant="outline" className="admin-public-cta h-10 px-4 sm:px-5"><Link to="/reservar">RESERVAR <ArrowUpRight /></Link></Button>}</div><nav className="flex shrink-0 items-center gap-4 sm:gap-8" aria-label="Navegación principal">{!admin && <Link to="/admin" className="text-xs text-muted-foreground transition-colors hover:text-foreground sm:text-sm">Administración</Link>}{!admin && <Button asChild className="h-10 px-4 sm:px-5"><Link to="/reservar">RESERVAR <ArrowUpRight /></Link></Button>}{admin && staff && <><div className="admin-account-identity"><strong>{staff.profile.role === 'ADMIN' ? 'KANI Admin' : staff.profile.display_name}</strong><span>{staff.profile.role}</span></div><Button variant="ghost" className="admin-signout" onClick={() => void signOut()}><LogOut />Cerrar sesión</Button></>}</nav></div></header>;
}

export function SiteFooter() { return <footer className="site-footer border-t text-xs text-muted-foreground"><div className="site-container flex flex-col gap-6 py-7 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-sm font-medium text-foreground">Kani Barber Studio</h2><p className="mt-2 leading-relaxed">San Isidro Labrador 7<br />Martínez, Provincia de Buenos Aires</p><p className="mt-2 leading-relaxed">Lunes a sábados<br />10:00 a 20:00 hs</p></div><div className="flex flex-col gap-3 sm:items-end"><div className="flex flex-wrap gap-4"><a href="https://www.google.com/maps/place/KANI+BARBER+STUDIO/data=!4m2!3m1!1s0x0:0x48bcfe7b2ea7ba60" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 hover:text-foreground"><MapPin size={14} /> Ver ubicación</a><a href="https://www.instagram.com/kanibarberstudio/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 hover:text-foreground"><Instagram size={14} /> Instagram</a></div><span>© 2026 Kani Barber Studio</span></div></div></footer>; }
