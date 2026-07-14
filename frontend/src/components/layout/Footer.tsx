import React from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Instagram, Linkedin, Twitter } from 'lucide-react';

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-primary-950 text-white border-t border-primary-900 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12 mb-8 md:mb-12">
          
          {/* Brand & Description */}
          <div className="col-span-1 lg:col-span-1">
            <Link to="/" className="flex items-center gap-3 mb-4 md:mb-6">
              <div className="h-10 w-10 bg-primary-600 rounded-lg flex items-center justify-center font-bold text-xl shadow-lg">
                CM
              </div>
              <span className="font-serif text-2xl tracking-tight">Chiara Morocutti Academy</span>
            </Link>
            <p className="text-gray-400 text-sm leading-relaxed mb-4 md:mb-6">
              L'accademia di formazione d'eccellenza per le professioniste del Permanent Make Up e dell'estetica avanzata.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-gray-400 hover:text-primary-400 transition-colors duration-300">
                <span className="sr-only">Facebook</span>
                <Facebook className="h-5 w-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-primary-400 transition-colors duration-300">
                <span className="sr-only">Instagram</span>
                <Instagram className="h-5 w-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-primary-400 transition-colors duration-300">
                <span className="sr-only">Twitter</span>
                <Twitter className="h-5 w-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-primary-400 transition-colors duration-300">
                <span className="sr-only">LinkedIn</span>
                <Linkedin className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Navigation Links */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4 md:mb-6">
              Esplora
            </h3>
            <ul className="space-y-2 md:space-y-4">
              <li>
                <Link to="/" className="text-base text-gray-400 hover:text-white transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/#corso" className="text-base text-gray-400 hover:text-white transition-colors">
                  Il Programma
                </Link>
              </li>
              <li>
                <Link to="/#vantaggi" className="text-base text-gray-400 hover:text-white transition-colors">
                  Perché Noi
                </Link>
              </li>
              <li>
                <Link to="/checkout" className="text-base text-gray-400 hover:text-white transition-colors">
                  Iscriviti Ora
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources Links */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4 md:mb-6">
              Risorse
            </h3>
            <ul className="space-y-2 md:space-y-4">
              <li>
                <a href="#" className="text-base text-gray-400 hover:text-white transition-colors">
                  Blog Estetica & PMU
                </a>
              </li>
              <li>
                <a href="#" className="text-base text-gray-400 hover:text-white transition-colors">
                  Guide Gratuite
                </a>
              </li>
              <li>
                <a href="#" className="text-base text-gray-400 hover:text-white transition-colors">
                  Webinar Live
                </a>
              </li>
              <li>
                <a href="#" className="text-base text-gray-400 hover:text-white transition-colors">
                  Supporto Studenti
                </a>
              </li>
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4 md:mb-6">
              Legale
            </h3>
            <ul className="space-y-2 md:space-y-4">
              <li>
                <a href="#" className="text-base text-gray-400 hover:text-white transition-colors">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#" className="text-base text-gray-400 hover:text-white transition-colors">
                  Termini di Servizio
                </a>
              </li>
              <li>
                <a href="#" className="text-base text-gray-400 hover:text-white transition-colors">
                  Cookie Policy
                </a>
              </li>
              <li>
                <a href="#" className="text-base text-gray-400 hover:text-white transition-colors">
                  Diritto di Recesso
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-gray-800 flex flex-col md:flex-row justify-between items-center">
          <p className="text-base text-gray-500 text-center md:text-left">
            &copy; {currentYear} Chiara Morocutti Academy. Tutti i diritti riservati. P.IVA 12345678901
          </p>
          <div className="mt-4 md:mt-0 flex space-x-6">
            <span className="text-sm text-gray-600">
              Designed for Beauty Professionals
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};