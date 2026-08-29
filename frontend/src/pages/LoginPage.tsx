import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LoginForm } from '../components/auth/LoginForm';
import { CheckCircle, Sparkles, Star } from 'lucide-react';

const logoUrl = "https://assets.cdn.filesafe.space/ceYe4VnMXLjh1ENSEbH0/media/64107bc74d97b25219e10bcf.png";

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
    <div className="min-h-screen flex bg-white">
      {/* Left Column: Form (full width on mobile, 50% on iPad & Desktop) */}
      <div className="w-full md:w-1/2 flex flex-col justify-center px-6 sm:px-12 md:px-8 lg:px-16 xl:px-24 py-12 bg-white">
        <div className="w-full max-w-md mx-auto">
          
          {/* Academy Brand Badge */}
          <div className="mb-6 flex items-center gap-3">
            <img 
              src={logoUrl} 
              alt="Chiara Morocutti" 
              width={40}
              height={40}
              className="h-10 w-10 rounded-full object-cover shadow-sm"
            />
            <div>
              <span className="text-sm font-bold text-primary-600 leading-tight block" style={{ fontFamily: 'Abhaya Libre, serif' }}>
                Chiara Morocutti Academy
              </span>
              <span className="text-[10px] text-gray-500 leading-none block" style={{ fontFamily: 'Abhaya Libre, serif' }}>
                Area Riservata Studenti
              </span>
            </div>
          </div>

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl sm:text-4xl font-serif font-bold text-gray-900 mb-2">
              Bentornata
            </h1>
            <p className="text-gray-500 text-sm sm:text-base">
              Accedi per continuare il tuo percorso formativo nella Masterclass.
            </p>
          </div>

          {showSuccess && (
            <div className="mb-8 bg-emerald-50 border border-emerald-200 rounded-2xl p-5 shadow-sm animate-fade-in">
              <div className="flex items-start gap-4">
                <div className="bg-emerald-100 p-2.5 rounded-full shrink-0">
                  <CheckCircle className="w-6 h-6 text-emerald-700" />
                </div>
                <div>
                  <h3 className="font-semibold text-emerald-950 text-base mb-1">
                    Accesso Masterclass Attivato 🎉
                  </h3>
                  <p className="text-emerald-900 text-sm leading-relaxed">
                    Ti abbiamo inviato un’email con la tua <strong>password temporanea</strong>.
                    <br className="mb-1" />
                    Inserisci la tua email e la password temporanea ricevuta: al primo accesso potrai impostare la tua password personale e definitiva per entrare subito nella tua area riservata.
                    <br/><br/>
                    <span className="text-emerald-800 text-xs font-medium bg-emerald-100/70 px-2.5 py-1 rounded-md">
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
          <div className="mt-8 text-center sm:text-left">
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
      
      {/* Right Column: Luxury Image & Quote (Visible on iPad, Tablet and Desktop: md:block) */}
      <div className="hidden md:block md:w-1/2 relative bg-primary-950 overflow-hidden">
        <img 
          src="/login-beauty.webp" 
          alt="Microblading Masterclass" 
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Luxury Vignette Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-primary-950/30 to-black/20"></div>

        {/* Floating Quote Card */}
        <div className="absolute bottom-10 left-8 right-8 lg:left-12 lg:right-12">
          <div className="rounded-2xl border border-white/20 bg-black/40 p-6 backdrop-blur-md shadow-2xl">
            <div className="flex items-center gap-1 text-amber-400 mb-2">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-current" />
              ))}
              <span className="ml-2 text-xs font-bold text-white tracking-wide uppercase">Formazione d'Eccellenza</span>
            </div>
            
            <p className="text-white text-sm lg:text-base font-serif italic leading-relaxed">
              "Il microblading non è solo una tecnica: è l'abilità di creare naturalezza assoluta e costruire un business che ti dà libertà e autorevolezza."
            </p>

            <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span className="text-xs font-semibold text-primary-200">Chiara Morocutti</span>
              </div>
              <span className="text-[11px] text-gray-400">Masterclass Ufficiale</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
