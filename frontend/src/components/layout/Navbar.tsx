import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuthContext } from '../auth/useAuthContext'; 
import { Button } from '../common/Button';

// Logo URL dal sito della cliente
const logoUrl = "https://assets.cdn.filesafe.space/ceYe4VnMXLjh1ENSEbH0/media/64107bc74d97b25219e10bcf.png";

interface NavbarProps {
  mobileMenuOpen?: boolean;
  setMobileMenuOpen?: (open: boolean) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ mobileMenuOpen: externalMobileMenuOpen, setMobileMenuOpen: externalSetMobileMenuOpen }) => {
  const [internalMobileMenuOpen, setInternalMobileMenuOpen] = useState(false);
  const mobileMenuOpen = externalMobileMenuOpen !== undefined ? externalMobileMenuOpen : internalMobileMenuOpen;
  const setMobileMenuOpen = externalSetMobileMenuOpen || setInternalMobileMenuOpen;
  const { isAuthenticated, isAdmin } = useAuthContext();

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
          if (onClick) onClick();
        }
      } 
    };

    return (
      <Link to={to} className={className} onClick={handleClick}>
        {children}
      </Link>
    );
  };

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          
          {/* Left: Hamburger button (< lg) + Logo */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Mobile / Tablet Hamburger Button */}
            {!isAuthenticated && (
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden flex-shrink-0 min-h-10 min-w-10 p-2 rounded-lg hover:bg-gray-100 text-gray-700 flex items-center justify-center -ml-1"
                aria-label={mobileMenuOpen ? 'Chiudi menu' : 'Apri menu'}
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            )}
            
            {/* Logo & Brand Name */}
            <Link 
              to={isAuthenticated ? (isAdmin ? '/admin' : '/dashboard') : '/'} 
              className="flex items-center gap-2.5 sm:gap-3 min-w-0"
            >
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

          {/* Center: Navigation Links (Desktop ONLY >= lg) */}
          {!isAuthenticated && (
            <div className="hidden lg:flex items-center space-x-6 xl:space-x-8">
              <ScrollLink to="/#corso" className="text-sm xl:text-base font-medium text-gray-700 hover:text-primary-600 transition" onClick={() => {}}>Il Corso</ScrollLink>
              <ScrollLink to="/#vantaggi" className="text-sm xl:text-base font-medium text-gray-700 hover:text-primary-600 transition" onClick={() => {}}>Vantaggi</ScrollLink>
              <ScrollLink to="/#anteprima" className="text-sm xl:text-base font-medium text-gray-700 hover:text-primary-600 transition" onClick={() => {}}>Anteprima</ScrollLink>
              <ScrollLink to="/#testimonianze" className="text-sm xl:text-base font-medium text-gray-700 hover:text-primary-600 transition" onClick={() => {}}>Testimonianze</ScrollLink>
            </div>
          )}

          {/* Right: Actions */}
          {!isAuthenticated && (
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {/* Desktop Buttons (>= lg) */}
              <div className="hidden lg:flex items-center gap-3">
                <Link to="/login"><Button variant="ghost">Login</Button></Link>
                <Link to="/checkout"><Button variant="primary">Vai al Checkout</Button></Link>
              </div>
              {/* Mobile / Tablet Quick Checkout Button (< lg) */}
              <Link to="/checkout" className="lg:hidden shrink-0">
                <Button variant="primary" size="sm">
                  Vai al Checkout
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Mobile & Tablet Drawer Menu (< lg) */}
      {mobileMenuOpen && !isAuthenticated && (
        <div className="lg:hidden border-t border-gray-200 bg-white shadow-xl animate-in slide-in-from-top-2 duration-200">
          <div className="px-5 py-4 space-y-1">
            <ScrollLink to="/#corso" className="block px-3 py-2.5 rounded-xl text-base font-semibold text-gray-800 hover:bg-primary-50 hover:text-primary-700 transition" onClick={() => setMobileMenuOpen(false)}>Il Corso</ScrollLink>
            <ScrollLink to="/#vantaggi" className="block px-3 py-2.5 rounded-xl text-base font-semibold text-gray-800 hover:bg-primary-50 hover:text-primary-700 transition" onClick={() => setMobileMenuOpen(false)}>Vantaggi</ScrollLink>
            <ScrollLink to="/#anteprima" className="block px-3 py-2.5 rounded-xl text-base font-semibold text-gray-800 hover:bg-primary-50 hover:text-primary-700 transition" onClick={() => setMobileMenuOpen(false)}>Anteprima</ScrollLink>
            <ScrollLink to="/#testimonianze" className="block px-3 py-2.5 rounded-xl text-base font-semibold text-gray-800 hover:bg-primary-50 hover:text-primary-700 transition" onClick={() => setMobileMenuOpen(false)}>Testimonianze</ScrollLink>
            
            <div className="border-t border-gray-100 pt-3 mt-2 flex flex-col gap-2">
              <Link to="/login" className="block text-center py-2.5 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 border border-gray-200" onClick={() => setMobileMenuOpen(false)}>Login Corsiste</Link>
              <Link to="/checkout" onClick={() => setMobileMenuOpen(false)}><Button variant="primary" fullWidth size="lg">Iscriviti alla Masterclass</Button></Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};
