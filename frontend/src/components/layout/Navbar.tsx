import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Shield } from 'lucide-react';
import { useAuthContext } from '../auth/useAuthContext'; 
import { Button } from '../common/Button';


interface NavbarProps {
  mobileMenuOpen?: boolean;
  setMobileMenuOpen?: (open: boolean) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ mobileMenuOpen: externalMobileMenuOpen, setMobileMenuOpen: externalSetMobileMenuOpen }) => {
  const [internalMobileMenuOpen, setInternalMobileMenuOpen] = useState(false);
  const mobileMenuOpen = externalMobileMenuOpen !== undefined ? externalMobileMenuOpen : internalMobileMenuOpen;
  const setMobileMenuOpen = externalSetMobileMenuOpen || setInternalMobileMenuOpen;
  const { isAuthenticated, isAdmin } = useAuthContext();
  const location = useLocation();
  const isAdminViewingStudentArea = isAdmin && (
    location.pathname === '/dashboard' || location.pathname.startsWith('/courses/')
  );

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname, setMobileMenuOpen]);

  const ScrollLink = ({
    to,
    children,
    className,
    onClick,
  }: {
    to: string;
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
  }) => {
    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
      const isHomePage = window.location.pathname === '/';
      
      if (isHomePage && to.startsWith('/#')) {
        e.preventDefault();
        const id = to.substring(2); // Rimuove '/#'
        const element = document.getElementById(id);
        if (element) {
          const yOffset = -70;
          const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
          window.scrollTo({ top: y, behavior: 'smooth' });
        }
      }

      onClick?.();
    };

    return (
      <Link to={to} className={className} onClick={handleClick}>
        {children}
      </Link>
    );
  };

  return (
    <nav className="relative z-50 bg-[#FAF7F2] border-b border-[#E8E1D5] w-full transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {!isAuthenticated ? (
          /* Public Header (Editorial Luxury Academy) */
          <div className="flex justify-between items-center h-16 sm:h-20">
            {/* Left: Typographic Brand Logo (flush left, perfectly aligned, no crowding) */}
            <div className="flex items-center min-w-0">
              <Link to="/" className="flex flex-col items-start leading-none group py-1">
                <span className="text-[15px] sm:text-lg lg:text-xl font-serif font-bold tracking-[0.14em] sm:tracking-[0.16em] text-[#1E1B18] uppercase whitespace-nowrap">
                  Chiara Morocutti
                </span>
                <div className="flex items-center gap-1.5 w-full mt-0.5 sm:mt-1">
                  <span className="h-[1px] bg-[#8A7E73]/50 flex-1"></span>
                  <span className="text-[8.5px] sm:text-[10px] tracking-[0.22em] sm:tracking-[0.25em] font-serif uppercase text-[#8A7E73] font-medium whitespace-nowrap">
                    Academy
                  </span>
                  <span className="h-[1px] bg-[#8A7E73]/50 flex-1"></span>
                </div>
              </Link>
            </div>

            {/* Center: Navigation Links (Public Desktop ONLY >= lg) */}
            <div className="hidden lg:flex items-center space-x-7 xl:space-x-9">
              <ScrollLink to="/#video-academy" className="text-xs tracking-[0.14em] uppercase font-semibold text-[#4A443E] hover:text-[#1E1B18] transition" onClick={() => {}}>Il Corso</ScrollLink>
              <ScrollLink to="/#programma" className="text-xs tracking-[0.14em] uppercase font-semibold text-[#4A443E] hover:text-[#1E1B18] transition" onClick={() => {}}>Programma</ScrollLink>
              <ScrollLink to="/#chisono" className="text-xs tracking-[0.14em] uppercase font-semibold text-[#4A443E] hover:text-[#1E1B18] transition" onClick={() => {}}>Chi Sono</ScrollLink>
              <ScrollLink to="/#percorsi" className="text-xs tracking-[0.14em] uppercase font-semibold text-[#4A443E] hover:text-[#1E1B18] transition" onClick={() => {}}>Percorsi</ScrollLink>
              <ScrollLink to="/#faq" className="text-xs tracking-[0.14em] uppercase font-semibold text-[#4A443E] hover:text-[#1E1B18] transition" onClick={() => {}}>FAQ</ScrollLink>
            </div>

            {/* Right: Actions on Desktop, Hamburger button on Mobile (< lg) */}
            <div className="flex items-center gap-3 sm:gap-4 shrink-0">
              <Link 
                to="/login" 
                className="hidden sm:inline-block text-xs uppercase tracking-wider font-semibold text-[#6E645B] hover:text-[#1E1B18] transition px-2 py-1"
              >
                Login
              </Link>
              <ScrollLink
                to="/#percorsi"
                className="hidden sm:inline-flex px-5 sm:px-6 py-2.5 sm:py-3 bg-[#1E1B18] text-white text-[11px] sm:text-xs font-bold uppercase tracking-[0.15em] rounded-sm hover:bg-[#332C27] active:scale-[0.99] transition shadow-xs"
                onClick={() => {}}
              >
                Scopri l'Academy
              </ScrollLink>

              {/* Mobile/Tablet Hamburger button on the RIGHT (< lg) */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden flex-shrink-0 min-h-10 min-w-10 p-2 rounded-lg hover:bg-black/5 text-[#1E1B18] flex items-center justify-center transition-colors -mr-1"
                aria-label={mobileMenuOpen ? 'Chiudi menu' : 'Apri menu'}
                aria-expanded={mobileMenuOpen}
                aria-controls="public-navigation-menu"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        ) : (
          /* Authenticated Header (Left-aligned Typographic Brand, consistent with public header) */
          <div className="flex items-center justify-between h-16">
            {/* Left: Hamburger button for mobile/tablet (< xl) + Typographic Brand Logo */}
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="xl:hidden flex-shrink-0 min-h-10 min-w-10 p-2 rounded-lg hover:bg-black/5 text-[#1E1B18] flex items-center justify-center -ml-1 transition-colors"
                aria-label={mobileMenuOpen ? 'Chiudi menu' : 'Apri menu'}
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>

              <Link 
                to={isAdminViewingStudentArea ? '/dashboard' : isAdmin ? '/admin' : '/dashboard'} 
                className="flex flex-col items-start leading-none group py-1 shrink-0"
              >
                <span className="text-[15px] sm:text-lg lg:text-xl font-serif font-bold tracking-[0.14em] sm:tracking-[0.16em] text-[#1E1B18] uppercase whitespace-nowrap">
                  Chiara Morocutti
                </span>
                <div className="flex items-center gap-1.5 w-full mt-0.5 sm:mt-1">
                  <span className="h-[1px] bg-[#8A7E73]/50 flex-1"></span>
                  <span className="text-[8.5px] sm:text-[10px] tracking-[0.22em] sm:tracking-[0.25em] font-serif uppercase text-[#8A7E73] font-medium whitespace-nowrap">
                    Academy
                  </span>
                  <span className="h-[1px] bg-[#8A7E73]/50 flex-1"></span>
                </div>
              </Link>

              {/* Area indicator badge */}
              <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wider uppercase bg-[#F4EFEA] text-[#6E645B] border border-[#E8E1D5] ml-1 whitespace-nowrap">
                {isAdminViewingStudentArea ? 'Area Corsista' : isAdmin ? 'Pannello Admin' : 'Area Corsista'}
              </span>
            </div>

            {/* Right: Actions / Quick Links */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {isAdminViewingStudentArea && (
                <Link
                  to="/admin"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-[#18181B] text-white text-xs font-semibold uppercase tracking-wider hover:bg-[#2C2724] transition shadow-xs"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Torna ad Admin</span>
                </Link>
              )}

              {isAdmin && !isAdminViewingStudentArea && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#18181B] text-white text-[11px] font-bold uppercase tracking-wider shadow-xs">
                  <Shield className="w-3.5 h-3.5 text-[#E5D2CF]" />
                  <span>Admin</span>
                </span>
              )}

              <Link
                to="/"
                className="hidden sm:inline-flex items-center px-3 py-1.5 rounded-sm border border-[#DCD3C7] text-[#5A5147] hover:text-[#18181B] hover:bg-white text-xs font-semibold uppercase tracking-wider transition"
                title="Vai al sito pubblico"
              >
                Sito
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Menu a comparsa: non spinge la landing verso il basso su tablet. */}
      {mobileMenuOpen && !isAuthenticated && (
        <>
          <button
            type="button"
            className="fixed inset-x-0 top-16 bottom-0 z-40 cursor-default lg:hidden"
            aria-label="Chiudi menu"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div
            id="public-navigation-menu"
            className="absolute inset-x-0 top-full z-50 lg:hidden border-t border-gray-200 bg-white shadow-xl animate-in slide-in-from-top-2 duration-200"
          >
            <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 bg-[#FAF7F2]">
              <div className="flex flex-col space-y-1">
                <ScrollLink to="/#video-academy" className="block px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-[#4A443E] hover:text-[#1E1B18] hover:bg-black/5 rounded transition" onClick={() => setMobileMenuOpen(false)}>Il Corso</ScrollLink>
                <ScrollLink to="/#programma" className="block px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-[#4A443E] hover:text-[#1E1B18] hover:bg-black/5 rounded transition" onClick={() => setMobileMenuOpen(false)}>Programma</ScrollLink>
                <ScrollLink to="/#chisono" className="block px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-[#4A443E] hover:text-[#1E1B18] hover:bg-black/5 rounded transition" onClick={() => setMobileMenuOpen(false)}>Chi Sono</ScrollLink>
                <ScrollLink to="/#percorsi" className="block px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-[#4A443E] hover:text-[#1E1B18] hover:bg-black/5 rounded transition" onClick={() => setMobileMenuOpen(false)}>Percorsi</ScrollLink>
                <ScrollLink to="/#faq" className="block px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-[#4A443E] hover:text-[#1E1B18] hover:bg-black/5 rounded transition" onClick={() => setMobileMenuOpen(false)}>FAQ</ScrollLink>
              </div>

              <div className="border-t border-gray-100 pt-3 mt-3 grid gap-2 sm:grid-cols-2 sm:gap-3">
                <Link to="/login" className="block text-center py-2.5 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 border border-gray-200" onClick={() => setMobileMenuOpen(false)}>Login Corsiste</Link>
                <a
                  href="https://wa.me/393428077768?text=Ciao%20Chiara,%20vorrei%20informazioni%20sui%20tuoi%20corsi%20di%20Microblading"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Button variant="primary" fullWidth size="md">Prenota una Call</Button>
                </a>
              </div>
            </div>
          </div>
        </>
      )}
    </nav>
  );
};
