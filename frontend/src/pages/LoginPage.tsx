import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LoginForm } from '../components/auth/LoginForm';
import { CheckCircle, ShieldCheck, Sparkles, Star, MessageCircle } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const location = useLocation();
  const [showSuccess, setShowSuccess] = useState(false);
  const [showLoginVisual, setShowLoginVisual] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
  ));

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('payment') === 'success' || searchParams.get('payment') === 'free') {
      setShowSuccess(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [location]);

  // Visual shown on iPad and desktop (>= 768px)
  useEffect(() => {
    const tabletLayout = window.matchMedia('(min-width: 768px)');
    const updateVisualVisibility = () => setShowLoginVisual(tabletLayout.matches);

    updateVisualVisibility();
    tabletLayout.addEventListener('change', updateVisualVisibility);
    return () => tabletLayout.removeEventListener('change', updateVisualVisibility);
  }, []);

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col md:flex-row bg-[#FAF7F2]">
      
      {/* Left Column: Full-Height Luxury Editorial Form Pane (50% on iPad/Desktop, 100% on Mobile) */}
      <div className="w-full md:w-1/2 min-h-[calc(100vh-4rem)] flex flex-col justify-start md:justify-center items-center pt-3 pb-8 sm:pt-6 sm:pb-10 md:py-10 lg:py-16 px-5 sm:px-8 md:px-8 lg:px-14 xl:px-20 bg-[#FAF7F2] md:border-r border-[#EAE3D7]">
        <div className="w-full max-w-md mt-1 sm:mt-2 md:my-auto flex flex-col justify-center">
          
          {/* Badge */}
          <div className="mb-3.5 text-center sm:text-left">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#E8E1D5] text-[#1E1B18] text-[11px] font-bold tracking-wider uppercase shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-[#B08D57]" />
              <span>Area Riservata Corsiste</span>
            </span>
          </div>

          {/* Header */}
          <div className="mb-5 text-center sm:text-left">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold text-[#1E1B18] leading-tight">
              Bentornata
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm text-[#6E645B] font-light leading-relaxed">
              Inserisci le tue credenziali per accedere alle tue video-lezioni della Masterclass.
            </p>
          </div>

          {showSuccess && (
            <div className="mb-5 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 sm:p-5 shadow-sm animate-fade-in">
              <div className="flex items-start gap-3.5">
                <div className="bg-emerald-100 p-2 rounded-full shrink-0">
                  <CheckCircle className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <h3 className="font-semibold text-emerald-950 text-sm sm:text-base mb-1">
                    Accesso Masterclass Attivato 🎉
                  </h3>
                  <p className="text-emerald-900 text-xs sm:text-sm leading-relaxed">
                    Ti abbiamo inviato un’email con la tua <strong>password temporanea</strong>.
                    <br className="mb-1" />
                    Inserisci la tua email e la password provvisoria: al primo accesso potrai impostare subito la tua password definitiva.
                    <br/><br/>
                    <span className="text-emerald-800 text-[11px] font-medium bg-emerald-100/70 px-2 py-0.5 rounded">
                      💡 Non trovi l'email? Controlla anche nella cartella Spam o Promozioni.
                    </span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Login Form (Clean White Card on Soft Ivory Canvas) */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#E8E1D5] shadow-md relative overflow-hidden">
            {/* Subtle Top Gold Accent line */}
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-[#E5D2CF] via-[#B08D57] to-[#E5D2CF]" />
            <LoginForm />
          </div>

          {/* Symmetrical Bottom Navigation & Reassurance */}
          <div className="mt-5 space-y-2.5 text-center">
            <p className="text-xs sm:text-sm text-gray-500">
              Non hai ancora un account?{' '}
              <Link
                to="/#percorsi"
                className="font-bold text-[#1E1B18] hover:text-[#B08D57] underline underline-offset-4 transition-colors"
              >
                Scopri la Masterclass
              </Link>
            </p>

            <div className="pt-1 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 text-[11px] text-gray-400">
              <span className="flex items-center gap-1 text-gray-500 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Accesso Sicuro SSL
              </span>
              <span>•</span>
              <span className="text-gray-500 font-medium">Piattaforma Ufficiale</span>
              <span>•</span>
              <a
                href="https://wa.me/393428077768?text=Ciao%20Chiara,%20ho%20difficolt%C3%A0%20ad%20accedere%20all'Area%20Corsiste"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-[#25D366] transition-colors font-medium inline-flex items-center gap-1"
              >
                <MessageCircle className="w-3 h-3 text-[#25D366]" />
                Assistenza Login
              </a>
            </div>
          </div>

        </div>
      </div>
      
      {/* Right Column: Full-Height Luxury Visual Pane (50% on iPad/Desktop >= md) */}
      {showLoginVisual && (
        <div className="hidden md:block md:w-1/2 relative bg-[#1E1B18] min-h-[calc(100vh-4rem)] overflow-hidden">
          <img 
            src="/images/chiara/chiara-orizzontale-sorriso.jpg" 
            alt="Chiara Morocutti - Masterclass Microblading" 
            decoding="async"
            fetchPriority="low"
            className="absolute inset-0 w-full h-full object-cover object-[center_top]"
          />
          {/* Luxury Vignette Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-black/15"></div>

          {/* Floating Quote Card */}
          <div className="absolute bottom-6 left-4 right-18 md:right-18 lg:left-8 lg:right-10 xl:left-12 xl:right-12 z-10">
            <div className="rounded-2xl border border-white/20 bg-black/70 p-4 sm:p-5 lg:p-6 backdrop-blur-md shadow-2xl">
              <div className="flex items-center gap-1 text-amber-400 mb-2">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-current" />
                ))}
                <span className="ml-2 text-[10px] sm:text-[11px] font-bold text-white tracking-wider uppercase">Formazione d'Eccellenza</span>
              </div>
              
              <p className="text-white text-xs sm:text-sm lg:text-base font-serif italic leading-relaxed">
                "Il microblading non è solo una tecnica: è l'abilità di creare naturalezza assoluta e costruire un business che ti dà libertà e autorevolezza."
              </p>

              <div className="mt-3 pt-2.5 border-t border-white/15 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span className="text-xs font-semibold text-rose-200">Chiara Morocutti</span>
                </div>
                <span className="text-[10.5px] sm:text-[11px] text-gray-300 font-medium">Masterclass Ufficiale</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
