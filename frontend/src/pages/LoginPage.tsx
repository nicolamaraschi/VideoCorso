import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LoginForm } from '../components/auth/LoginForm';
import { CheckCircle, Sparkles, Star } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const location = useLocation();
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('payment') === 'success' || searchParams.get('payment') === 'free') {
      setShowSuccess(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [location]);

  return (
    <div className="min-h-[calc(100vh-4rem)] flex bg-white">
      {/* Left Column: Form (54% on iPad/tablet for generous breathing room, 50% on desktop) */}
      <div className="w-full md:w-[54%] lg:w-1/2 flex flex-col justify-center px-6 sm:px-12 md:px-8 lg:px-16 xl:px-24 py-8 lg:py-12 bg-white">
        <div className="w-full max-w-md mx-auto">
          
          {/* Subtle Category Badge (No duplicate logo) */}
          <div className="mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-50 border border-primary-200/80 text-primary-800 text-xs font-semibold tracking-wide uppercase">
              <Sparkles className="w-3.5 h-3.5 text-primary-600" />
              <span>Area Riservata Corsiste</span>
            </span>
          </div>

          {/* Header */}
          <div className="mb-7">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold text-gray-900 leading-tight">
              Bentornata
            </h1>
            <p className="mt-2 text-sm sm:text-base text-gray-500 font-light leading-relaxed">
              Inserisci le tue credenziali per accedere alle tue video-lezioni della Masterclass.
            </p>
          </div>

          {showSuccess && (
            <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 sm:p-5 shadow-sm animate-fade-in">
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

          {/* Login Form */}
          <LoginForm />

          {/* Footer */}
          <div className="mt-8 text-center sm:text-left pt-2 border-t border-gray-100">
            <p className="text-sm text-gray-600">
              Non hai ancora un account?{' '}
              <Link
                to="/#corso"
                className="font-semibold text-primary-600 hover:text-primary-700 underline underline-offset-4"
              >
                Scopri la Masterclass
              </Link>
            </p>
          </div>
        </div>
      </div>
      
      {/* Right Column: Luxury Image & Quote (46% on iPad/tablet, 50% on desktop) */}
      <div className="hidden md:block md:w-[46%] lg:w-1/2 relative bg-primary-950 overflow-hidden min-h-[calc(100vh-4rem)]">
        <img 
          src="/login-beauty.webp" 
          alt="Microblading Masterclass" 
          className="absolute inset-0 w-full h-full object-cover object-[center_35%]"
        />
        {/* Luxury Vignette Gradient Overlay (darker at top for card, clear at center/bottom for treatment) */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/10 to-black/20"></div>

        {/* Floating Quote Card (Positioned at TOP so the treatment below is 100% visible) */}
        <div className="absolute top-6 left-6 right-6 lg:top-8 lg:left-10 lg:right-10 z-10">
          <div className="rounded-2xl border border-white/20 bg-black/45 p-4 sm:p-5 lg:p-6 backdrop-blur-md shadow-2xl">
            <div className="flex items-center gap-1 text-amber-400 mb-2">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-3.5 h-3.5 fill-current" />
              ))}
              <span className="ml-2 text-[11px] font-bold text-white tracking-wider uppercase">Formazione d'Eccellenza</span>
            </div>
            
            <p className="text-white text-xs sm:text-sm lg:text-base font-serif italic leading-relaxed">
              "Il microblading non è solo una tecnica: è l'abilità di creare naturalezza assoluta e costruire un business che ti dà libertà e autorevolezza."
            </p>

            <div className="mt-3 pt-2.5 border-t border-white/15 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span className="text-xs font-semibold text-primary-200">Chiara Morocutti</span>
              </div>
              <span className="text-[11px] text-gray-300">Masterclass Ufficiale</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
