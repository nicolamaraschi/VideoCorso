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
          element.scrollIntoView({ behavior: 'smooth' });
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
          <div className="flex items-center">
            {/* Mobile Menu Button */}
            <div className="md:hidden flex-shrink-0 mr-2">
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 -ml-2 rounded-lg hover:bg-gray-100">
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
            
            {/* Logo & Brand Text */}
            <div className="flex items-center flex-1 md:flex-none">
              <Link to={isAuthenticated ? (isAdmin ? '/admin' : '/dashboard') : '/'} className="flex items-center gap-3 w-full md:w-auto">
              <img 
                src={logoUrl} 
                alt="Chiara Morocutti" 
                className="h-10 w-auto rounded-full object-cover flex-shrink-0"
              />
              
              <div className="block flex-1 md:flex-none text-center md:text-left pr-10 md:pr-0">
                <span className="text-base md:text-lg font-bold text-primary-600 leading-tight block truncate" style={{ fontFamily: 'Abhaya Libre, serif' }}>
                  Chiara Morocutti Academy
                </span>
                <span className="text-[10px] md:text-xs text-gray-500 leading-tight block" style={{ fontFamily: 'Abhaya Libre, serif' }}>
                  Formazione d'Eccellenza
                </span>
              </div>
            </Link>
            </div>
          </div>

          {/* Link di navigazione (Desktop - Non autenticato) */}
          {!isAuthenticated && (
            <div className="hidden md:flex items-center space-x-8">
              <ScrollLink to="/#corso" className="text-gray-700 hover:text-primary-600 transition" onClick={() => {}}>Il Corso</ScrollLink>
              <ScrollLink to="/#vantaggi" className="text-gray-700 hover:text-primary-600 transition" onClick={() => {}}>Vantaggi</ScrollLink>
              <ScrollLink to="/#anteprima" className="text-gray-700 hover:text-primary-600 transition" onClick={() => {}}>Anteprima</ScrollLink>
              <ScrollLink to="/#testimonianze" className="text-gray-700 hover:text-primary-600 transition" onClick={() => {}}>Testimonianze</ScrollLink>
            </div>
          )}

          {/* Desktop Menu (Non Autenticato) */}
          {!isAuthenticated && (
            <div className="hidden md:flex items-center gap-4">
              <Link to="/login"><Button variant="ghost">Login</Button></Link>
              <Link to="/checkout"><Button variant="primary">Vai al Checkout</Button></Link>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && !isAuthenticated && (
        <div className="md:hidden border-t border-gray-200 bg-white">
          <div className="px-4 py-4 space-y-2">
            <ScrollLink to="/#corso" className="block px-4 py-2 rounded-lg hover:bg-gray-100" onClick={() => setMobileMenuOpen(false)}>Il Corso</ScrollLink>
            <ScrollLink to="/#vantaggi" className="block px-4 py-2 rounded-lg hover:bg-gray-100" onClick={() => setMobileMenuOpen(false)}>Vantaggi</ScrollLink>
            <ScrollLink to="/#anteprima" className="block px-4 py-2 rounded-lg hover:bg-gray-100" onClick={() => setMobileMenuOpen(false)}>Anteprima</ScrollLink>
            <Link to="/login" className="block px-4 py-2 rounded-lg hover:bg-gray-100" onClick={() => setMobileMenuOpen(false)}>Login</Link>
            <Link to="/checkout" onClick={() => setMobileMenuOpen(false)}><Button variant="primary" fullWidth>Vai al Checkout</Button></Link>
          </div>
        </div>
      )}
    </nav>
  );
};
