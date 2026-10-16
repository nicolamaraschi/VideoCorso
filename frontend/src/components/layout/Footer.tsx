import React from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Instagram } from 'lucide-react';
import { TikTokIcon, WhatsAppIcon } from '../common/SocialIcons';

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  const handleAnchorClick = (to: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (window.location.pathname === '/' && to.startsWith('/#')) {
      e.preventDefault();
      const id = to.substring(2);
      const el = document.getElementById(id);
      if (el) {
        const yOffset = -70;
        const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    }
  };

  return (
    <footer className="bg-[#18181B] text-[#FAF7F2] border-t border-[#2E2825] mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 mb-8 md:mb-12">
          
          {/* Brand & Contact Block (Left 5 columns on desktop) */}
          <div className="lg:col-span-5 flex flex-col items-start">
            <Link to="/" className="inline-flex items-center gap-3 mb-3.5">
              <div className="h-9 w-9 bg-[#2E2825] border border-[#E5D2CF]/30 rounded-lg flex items-center justify-center font-bold text-lg shadow-md text-[#FAF7F2]">
                CM
              </div>
              <span className="font-serif text-xl sm:text-2xl tracking-tight text-white font-medium">
                Chiara Morocutti Academy
              </span>
            </Link>

            <p className="text-gray-400 text-xs sm:text-sm leading-relaxed mb-4 max-w-md font-light">
              L'accademia di formazione d'eccellenza per le professioniste del Permanent Make Up e dell'estetica avanzata.
            </p>

            {/* Direct Contact & WhatsApp pill (Always inline, no awkward breaks) */}
            <div className="mb-5 w-full">
              <span className="text-gray-500 font-bold uppercase tracking-[0.16em] text-[10px] block mb-1.5">
                Contatto Diretto & Assistenza
              </span>
              <div className="flex flex-wrap items-center gap-2.5">
                <a 
                  href="tel:+393428077768" 
                  className="text-white hover:text-[#E5D2CF] transition-colors font-semibold text-sm tracking-wide whitespace-nowrap"
                >
                  +39 342 807 7768
                </a>
                <a
                  href="https://wa.me/393428077768?text=Ciao%20Chiara,%20vorrei%20informazioni%20sui%20corsi%20di%20Microblading"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[#25D366] hover:text-emerald-300 transition-all font-medium text-xs bg-[#25D366]/15 hover:bg-[#25D366]/25 px-2.5 py-1 rounded-full border border-[#25D366]/35 shadow-xs whitespace-nowrap shrink-0"
                  title="WhatsApp Business Chiara Morocutti"
                >
                  <WhatsAppIcon className="w-3.5 h-3.5 shrink-0" />
                  <span>WhatsApp Business</span>
                </a>
              </div>
            </div>

            {/* Social Channels */}
            <div className="flex items-center space-x-3">
              <a
                href="https://www.instagram.com/chiaramorocutti.microblading/?hl=en"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-[#E1306C] transition-colors border border-white/10"
                aria-label="Instagram Chiara Morocutti"
                title="Instagram"
              >
                <Instagram className="h-4 w-4" />
              </a>
              <a
                href="https://www.tiktok.com/@chiara.microblading?_t=8fAQiP1JhCr&_r=1"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors border border-white/10"
                aria-label="TikTok Chiara Morocutti"
                title="TikTok"
              >
                <TikTokIcon className="h-4 w-4" />
              </a>
              <a
                href="https://www.facebook.com/ChiaraMorocuttiPmu/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-[#1877F2] transition-colors border border-white/10"
                aria-label="Facebook Chiara Morocutti"
                title="Facebook"
              >
                <Facebook className="h-4 w-4" />
              </a>
              <a
                href="https://wa.me/393428077768?text=Ciao%20Chiara,%20vorrei%20informazioni%20sui%20corsi%20di%20Microblading"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-[#25D366] transition-colors border border-white/10"
                aria-label="WhatsApp Business"
                title="WhatsApp Business"
              >
                <WhatsAppIcon className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Navigation Links Grid (Right 7 columns on desktop, 2-column on mobile) */}
          <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-6 sm:gap-8 pt-6 lg:pt-0 border-t lg:border-t-0 border-white/10">
            
            {/* Column 1: Esplora */}
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-[0.16em] mb-3 sm:mb-4">
                Esplora
              </h3>
              <ul className="space-y-2 text-xs sm:text-sm">
                <li>
                  <Link to="/" className="text-gray-400 hover:text-white transition-colors py-0.5 block">
                    Home
                  </Link>
                </li>
                <li>
                  <Link 
                    to="/#programma" 
                    onClick={handleAnchorClick('/#programma')}
                    className="text-gray-400 hover:text-white transition-colors py-0.5 block"
                  >
                    Il Programma
                  </Link>
                </li>
                <li>
                  <Link 
                    to="/#percorsi" 
                    onClick={handleAnchorClick('/#percorsi')}
                    className="text-gray-400 hover:text-white transition-colors py-0.5 block"
                  >
                    I Percorsi
                  </Link>
                </li>
                <li>
                  <Link 
                    to="/#faq" 
                    onClick={handleAnchorClick('/#faq')}
                    className="text-gray-400 hover:text-white transition-colors py-0.5 block"
                  >
                    FAQ
                  </Link>
                </li>
                <li>
                  <a
                    href="https://link.delera.co/widget/bookings/videocall-studentesse-chiara"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-[#E5D2CF] font-medium transition-colors py-0.5 block"
                  >
                    Prenota una Call
                  </a>
                </li>
              </ul>
            </div>

            {/* Column 2: Risorse & Academy */}
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-[0.16em] mb-3 sm:mb-4">
                Risorse
              </h3>
              <ul className="space-y-2 text-xs sm:text-sm">
                <li>
                  <Link 
                    to="/#chisono" 
                    onClick={handleAnchorClick('/#chisono')}
                    className="text-gray-400 hover:text-white transition-colors py-0.5 block"
                  >
                    Chi Sono
                  </Link>
                </li>
                <li>
                  <Link 
                    to="/#vantaggi" 
                    onClick={handleAnchorClick('/#vantaggi')}
                    className="text-gray-400 hover:text-white transition-colors py-0.5 block"
                  >
                    Il Metodo
                  </Link>
                </li>
                <li>
                  <Link to="/login" className="text-gray-400 hover:text-white transition-colors py-0.5 block">
                    Area Corsiste (Login)
                  </Link>
                </li>
                <li>
                  <a 
                    href="https://wa.me/393428077768?text=Ciao%20Chiara,%20vorrei%20informazioni%20sui%20corsi%20di%20Microblading" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-gray-400 hover:text-white transition-colors py-0.5 block"
                  >
                    Supporto & Info
                  </a>
                </li>
              </ul>
            </div>

            {/* Column 3: Legale */}
            <div className="col-span-2 sm:col-span-1 pt-4 sm:pt-0 border-t sm:border-t-0 border-white/5">
              <h3 className="text-xs font-bold text-white uppercase tracking-[0.16em] mb-3 sm:mb-4">
                Legale
              </h3>
              <ul className="space-y-2 text-xs sm:text-sm grid grid-cols-2 sm:grid-cols-1 gap-1 sm:gap-2">
                <li>
                  <a href="#" className="text-gray-400 hover:text-white transition-colors py-0.5 block">
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 hover:text-white transition-colors py-0.5 block">
                    Termini di Servizio
                  </a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 hover:text-white transition-colors py-0.5 block">
                    Cookie Policy
                  </a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 hover:text-white transition-colors py-0.5 block">
                    Diritto di Recesso
                  </a>
                </li>
              </ul>
            </div>

          </div>
        </div>

        {/* Bottom Bar: Copyright & CloudOrbit attribution */}
        <div className="pt-6 sm:pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-3 text-xs text-gray-400">
          <p className="text-center md:text-left">
            &copy; {currentYear} Chiara Morocutti Academy. Tutti i diritti riservati. P.IVA 12841360964 • Tel:{' '}
            <a href="tel:+393428077768" className="hover:text-white transition-colors whitespace-nowrap">
              +39 342 807 7768
            </a>
          </p>
          <div className="flex items-center gap-1.5 text-center md:text-right">
            <span>Sito disegnato e progettato da</span>
            <a
              href="https://cloudorbit.it/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#E5D2CF] hover:text-white font-semibold transition-colors underline decoration-[#E5D2CF]/40 underline-offset-4"
            >
              CloudOrbit
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
