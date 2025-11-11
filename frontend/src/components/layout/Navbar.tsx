import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X, User, LogOut } from 'lucide-react';
import { useAuthContext } from '../auth/AuthContext'; // <--- Percorso corretto
import { Button } from '../common/Button';

// Logo URL dal sito della cliente
const logoUrl = "https://assets.cdn.filesafe.space/ceYe4VnMXLjh1ENSEbH0/media/64107bc74d97b25219e10bcf.png";

export const Navbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { isAuthenticated, user, isAdmin, logout } = useAuthContext();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    setUserMenuOpen(false); // Chiudi il menu dopo il logout
    navigate('/login');
  };

  // Helper per creare link che funzionano sia come Link che come smooth scroll
  const ScrollLink = ({ to, children, className, onClick }) => {
    const handleClick = (e) => {
      const isHomePage = window.location.pathname === '/';
      
      // Se siamo nella homepage, facciamo lo scroll
      if (isHomePage && to.startsWith('/#')) {
        e.preventDefault();
        const id = to.substring(2); // Rimuove '/#'
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
          if (onClick) onClick();
        }
      } 
      // Se non siamo nella homepage, usiamo il Link normale
      // che ci porterà prima alla homepage e poi allo scrolling
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
          
          {/* Logo */}
          <div className="flex items-center">
            <Link to={isAuthenticated ? '/dashboard' : '/'} className="flex items-center gap-3">
              <img 
                src={logoUrl} 
                alt="Logo Chiara Morocutti PMU" 
                className="h-10 w-auto"
              />
              {/* Nascondiamo il testo su mobile per non affollare la navbar */}
              <div className="hidden md:block">
                <span className="text-lg font-bold text-primary-600 leading-tight block" style={{ fontFamily: 'Abhaya Libre, serif' }}>
                  Chiara Morocutti PMU
                </span>
                <span className="text-xs text-gray-500 leading-tight block" style={{ fontFamily: 'Abhaya Libre, serif' }}>
                  Milano, Corso Italia 49
                </span>
              </div>
            </Link>
          </div>

          {/* Link di navigazione - CORRETTI */}
          <div className="hidden md:flex items-center space-x-8">
            <ScrollLink 
              to="/#corso" 
              className="text-gray-700 hover:text-primary-600 transition"
              onClick={() => {}}
            >
              Il Corso
            </ScrollLink>
            <ScrollLink 
              to="/#vantaggi" 
              className="text-gray-700 hover:text-primary-600 transition"
              onClick={() => {}}
            >
              Vantaggi
            </ScrollLink>
            <ScrollLink 
              to="/#anteprima" 
              className="text-gray-700 hover:text-primary-600 transition"
              onClick={() => {}}
            >
              Anteprima
            </ScrollLink>
            <ScrollLink 
              to="/#testimonianze" 
              className="text-gray-700 hover:text-primary-600 transition"
              onClick={() => {}}
            >
              Testimonianze
            </ScrollLink>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <Link to="/dashboard">
                  <Button variant="ghost">I Miei Corsi</Button>
                </Link>

                {isAdmin && (
                  <Link to="/admin">
                    <Button variant="ghost">Admin</Button>
                  </Link>
                )}

                {/* User Menu */}
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-sm font-medium text-gray-700">
                      {user?.fullName || user?.email}
                    </span>
                  </button>

                  {userMenuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setUserMenuOpen(false)}
                      />
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          <LogOut className="w-4 h-4" />
                          Logout
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost">Login</Button>
                </Link>
                <Link to="/checkout">
                  <Button variant="primary">Iscriviti Ora</Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg hover:bg-gray-100"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white">
          <div className="px-4 py-4 space-y-2">
            {/* Link di navigazione per mobile - CORRETTI */}
            <ScrollLink
              to="/#corso"
              className="block px-4 py-2 rounded-lg hover:bg-gray-100"
              onClick={() => setMobileMenuOpen(false)}
            >
              Il Corso
            </ScrollLink>
            <ScrollLink
              to="/#vantaggi"
              className="block px-4 py-2 rounded-lg hover:bg-gray-100"
              onClick={() => setMobileMenuOpen(false)}
            >
              Vantaggi
            </ScrollLink>
            <ScrollLink
              to="/#anteprima"
              className="block px-4 py-2 rounded-lg hover:bg-gray-100"
              onClick={() => setMobileMenuOpen(false)}
            >
              Anteprima
            </ScrollLink>
            <ScrollLink
              to="/#testimonianze"
              className="block px-4 py-2 rounded-lg hover:bg-gray-100"
              onClick={() => setMobileMenuOpen(false)}
            >
              Testimonianze
            </ScrollLink>

            {isAuthenticated ? (
              <>
                <Link
                  to="/dashboard"
                  className="block px-4 py-2 rounded-lg hover:bg-gray-100"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  I Miei Corsi
                </Link>

                {isAdmin && (
                  <Link
                    to="/admin"
                    className="block px-4 py-2 rounded-lg hover:bg-gray-100"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Admin
                  </Link>
                )}

                <button
                  onClick={() => {
                    handleLogout();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-2 rounded-lg hover:bg-gray-100 flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="block px-4 py-2 rounded-lg hover:bg-gray-100"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Login
                </Link>
                <Link
                  to="/checkout"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Button variant="primary" fullWidth>
                    Iscriviti Ora
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};