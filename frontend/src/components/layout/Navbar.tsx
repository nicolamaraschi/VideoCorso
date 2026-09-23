import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Shield } from 'lucide-react';
import { useAuthContext } from '../auth/useAuthContext'; 
import { Button } from '../common/Button';

// Versione locale WebP dimensionata per l'uso reale nella navbar (40 px).
const logoUrl = "/chiara-morocutti-logo.webp";

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
    <nav className="relative z-50 bg-white shadow-sm border-b border-gray-200 w-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {!isAuthenticated ? (
          /* Public Header (Landing Page) */
          <div className="flex justify-between items-center h-16">
            {/* Left: Hamburger button + Logo */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden flex-shrink-0 min-h-10 min-w-10 p-2 rounded-lg hover:bg-gray-100 text-gray-700 flex items-center justify-center -ml-1 transition-colors"
                aria-label={mobileMenuOpen ? 'Chiudi menu' : 'Apri menu'}
                aria-expanded={mobileMenuOpen}
                aria-controls="public-navigation-menu"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
              
              <Link to="/" className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <img 
                  src={logoUrl} 
                  alt="Chiara Morocutti" 
                  width={40}
                  height={40}
                  className="h-9 w-9 sm:h-10 sm:w-10 rounded-full object-cover flex-shrink-0 shadow-sm"
                />
                <div className="flex flex-col min-w-0">
                  <span className="text-sm sm:text-base lg:text-lg font-bold text-primary-600 leading-tight block truncate" style={{ fontFamily: 'Abhaya Libre, serif' }}>
                    Chiara Morocutti Academy
                  </span>
                  <span className="text-[9px] sm:text-xs text-gray-500 leading-tight block truncate" style={{ fontFamily: 'Abhaya Libre, serif' }}>
                    Formazione d'Eccellenza
                  </span>
                </div>
              </Link>
            </div>

            {/* Center: Navigation Links (Public Desktop ONLY >= lg) */}
            <div className="hidden lg:flex items-center space-x-6 xl:space-x-8">
              <ScrollLink to="/#corso" className="text-sm xl:text-base font-medium text-gray-700 hover:text-primary-600 transition" onClick={() => {}}>Il Corso</ScrollLink>
              <ScrollLink to="/#vantaggi" className="text-sm xl:text-base font-medium text-gray-700 hover:text-primary-600 transition" onClick={() => {}}>Vantaggi</ScrollLink>
              <ScrollLink to="/#testimonianze" className="text-sm xl:text-base font-medium text-gray-700 hover:text-primary-600 transition" onClick={() => {}}>Testimonianze</ScrollLink>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <div className="hidden lg:flex items-center gap-3">
                <Link to="/login"><Button variant="ghost">Login</Button></Link>
                <a
                  href="https://wa.me/393428077768?text=Ciao%20Chiara,%20vorrei%20informazioni%20sui%20tuoi%20corsi%20di%20Microblading"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="primary">Prenota una Call</Button>
                </a>
              </div>
              <a
                href="https://wa.me/393428077768?text=Ciao%20Chiara,%20vorrei%20informazioni%20sui%20tuoi%20corsi%20di%20Microblading"
                target="_blank"
                rel="noopener noreferrer"
                className="lg:hidden shrink-0"
              >
                <Button variant="primary" size="sm">
                  Prenota Call
                </Button>
              </a>
            </div>
          </div>
        ) : (
          /* Authenticated Header (Centered Brand, no duplicate user badge) */
          <div className="relative flex items-center justify-between h-16">
            {/* Left: Hamburger button for mobile/tablet (< xl) */}
            <div className="flex items-center min-w-[40px] z-10">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="xl:hidden flex-shrink-0 min-h-10 min-w-10 p-2 rounded-lg hover:bg-gray-100 text-gray-700 flex items-center justify-center -ml-1 transition-colors"
                aria-label={mobileMenuOpen ? 'Chiudi menu' : 'Apri menu'}
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>

            {/* Center: Perfectly Centered Chiara Morocutti Academy Brand */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-12">
              <Link 
                to={isAdminViewingStudentArea ? '/dashboard' : isAdmin ? '/admin' : '/dashboard'}
                className="flex items-center gap-2.5 sm:gap-3 pointer-events-auto min-w-0 max-w-full"
              >
                <img 
                  src={logoUrl} 
                  alt="Chiara Morocutti" 
                  width={40}
                  height={40}
                  className="h-9 w-9 sm:h-10 sm:w-10 rounded-full object-cover flex-shrink-0 shadow-sm"
                />
                
                <div className="flex flex-col min-w-0 text-center sm:text-left">
                  <span className="text-sm sm:text-base lg:text-lg font-bold text-primary-600 leading-tight block truncate" style={{ fontFamily: 'Abhaya Libre, serif' }}>
                    Chiara Morocutti Academy
                  </span>
                  <span className="text-[9px] sm:text-xs text-gray-500 leading-tight block truncate" style={{ fontFamily: 'Abhaya Libre, serif' }}>
                    {isAdminViewingStudentArea ? 'Area Corsista' : isAdmin ? 'Pannello Amministrazione' : "Formazione d'Eccellenza"}
                  </span>
                </div>
              </Link>
            </div>

            {/* Right: Subtle Admin indicator (if admin) or empty spacer for symmetry */}
            <div className="flex items-center min-w-[40px] justify-end z-10">
              {isAdmin && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-50 border border-primary-200 text-primary-800 text-xs font-bold uppercase tracking-wider">
                  <Shield className="w-3.5 h-3.5 text-primary-600" />
                  <span className="hidden sm:inline">Admin</span>
                </span>
              )}
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
            <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
              <div className="grid gap-1 sm:grid-cols-3 sm:gap-2">
                <ScrollLink to="/#corso" className="block px-3 py-2.5 rounded-xl text-base font-semibold text-gray-800 hover:bg-primary-50 hover:text-primary-700 transition sm:text-sm sm:text-center" onClick={() => setMobileMenuOpen(false)}>Il Corso</ScrollLink>
                <ScrollLink to="/#vantaggi" className="block px-3 py-2.5 rounded-xl text-base font-semibold text-gray-800 hover:bg-primary-50 hover:text-primary-700 transition sm:text-sm sm:text-center" onClick={() => setMobileMenuOpen(false)}>Vantaggi</ScrollLink>
                <ScrollLink to="/#testimonianze" className="block px-3 py-2.5 rounded-xl text-base font-semibold text-gray-800 hover:bg-primary-50 hover:text-primary-700 transition sm:text-sm sm:text-center" onClick={() => setMobileMenuOpen(false)}>Testimonianze</ScrollLink>
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
