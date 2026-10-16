import React from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Instagram, Linkedin, Twitter } from 'lucide-react';
import { WhatsAppIcon } from '../common/FloatingWhatsAppButton';

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#18181B] text-[#FAF7F2] border-t border-[#2E2825] mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12 mb-8 md:mb-12">
          
          {/* Brand & Description */}
          <div className="col-span-1 lg:col-span-1">
            <Link to="/" className="flex items-center gap-3 mb-4 md:mb-6">
              <div className="h-10 w-10 bg-[#2E2825] border border-[#E5D2CF]/30 rounded-lg flex items-center justify-center font-bold text-xl shadow-md text-[#FAF7F2]">
                CM
              </div>
              <span className="font-serif text-2xl tracking-tight text-white">Chiara Morocutti Academy</span>
            </Link>
            <p className="text-gray-400 text-sm leading-relaxed mb-3">
              L'accademia di formazione d'eccellenza per le professioniste del Permanent Make Up e dell'estetica avanzata.
            </p>
            <div className="text-xs text-gray-400 mb-4 md:mb-6 space-y-1.5">
              <span className="text-gray-500 font-semibold uppercase tracking-wider text-[11px] block">Contatto Diretto & Assistenza</span>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm">
                <a href="tel:+393428077768" className="text-[#FAF7F2] hover:text-[#E5D2CF] transition-colors font-medium">
                  +39 342 807 7768
                </a>
                <span className="hidden sm:inline text-gray-600">•</span>
                <a
                  href="https://wa.me/393428077768?text=Ciao%20Chiara,%20vorrei%20informazioni%20sui%20corsi%20di%20Microblading"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[#25D366] hover:text-emerald-400 transition-colors font-medium text-xs bg-[#25D366]/10 hover:bg-[#25D366]/20 px-2.5 py-1 rounded-full border border-[#25D366]/30 self-start sm:self-auto"
                >
                  <WhatsAppIcon className="w-3.5 h-3.5" />
                  <span>WhatsApp Business</span>
                </a>
              </div>
            </div>
            <div className="flex space-x-4">
              <a href="#" className="text-gray-400 hover:text-[#E5D2CF] transition-colors duration-300">
                <span className="sr-only">Facebook</span>
                <Facebook className="h-5 w-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-[#E5D2CF] transition-colors duration-300">
                <span className="sr-only">Instagram</span>
                <Instagram className="h-5 w-5" />
              </a>
              <a
                href="https://wa.me/393428077768?text=Ciao%20Chiara,%20vorrei%20informazioni%20sui%20corsi%20di%20Microblading"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-[#25D366] transition-colors duration-300"
                aria-label="Contattaci su WhatsApp Business"
                title="WhatsApp Business"
              >
                <span className="sr-only">WhatsApp</span>
                <WhatsAppIcon className="h-5 w-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-[#E5D2CF] transition-colors duration-300">
                <span className="sr-only">Twitter</span>
                <Twitter className="h-5 w-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-[#E5D2CF] transition-colors duration-300">
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
                <a
                  href="https://link.delera.co/widget/bookings/videocall-studentesse-chiara"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-base text-gray-400 hover:text-white transition-colors"
                >
                  Prenota una Call
                </a>
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
            &copy; {currentYear} Chiara Morocutti Academy. Tutti i diritti riservati. P.IVA 12841360964 • Tel: <a href="tel:+393428077768" className="hover:text-white transition-colors">+39 342 807 7768</a>
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
