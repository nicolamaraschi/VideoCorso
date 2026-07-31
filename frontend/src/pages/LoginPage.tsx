import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LoginForm } from '../components/auth/LoginForm';
import { CheckCircle } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const location = useLocation();
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('payment') === 'success') {
      setShowSuccess(true);
      // Clean up the URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [location]);

  return (
    <div className="min-h-screen flex">
      {/* Left Column: Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 sm:px-12 md:px-24 py-12 bg-white">
        <div className="w-full max-w-md mx-auto">
          {/* Header */}
          <div className="mb-10 text-center lg:text-left">
            <h1 className="text-3xl md:text-4xl font-serif font-bold text-gray-900 mb-3">
              Bentornata
            </h1>
            <p className="text-gray-500 text-lg">
              Accedi per continuare il tuo percorso formativo nella Masterclass.
            </p>
          </div>

          {showSuccess && (
            <div className="mb-8 bg-green-50 border border-green-200 rounded-xl p-5 shadow-sm animate-fade-in">
              <div className="flex items-start gap-4">
                <div className="bg-green-100 p-2 rounded-full">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-medium text-green-900 mb-1">
                    Grazie per il tuo acquisto! 🎉
                  </h3>
                  <p className="text-green-800 text-sm leading-relaxed">
                    Ti abbiamo appena inviato un'email con una <strong>password temporanea</strong> per accedere. 
                    Al tuo primo accesso ti verrà chiesto di scegliere la tua password definitiva.
                    <br/><br/>
                    <span className="text-green-700 text-xs italic">
                      (Se non la trovi, controlla anche nella casella Spam)
                    </span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Login Form */}
          <LoginForm />

          {/* Footer */}
          <div className="mt-8 text-center lg:text-left">
            <p className="text-sm text-gray-600">
              Non hai ancora un account?{' '}
              <Link
                to="/#catalogo"
                className="font-medium text-primary-600 hover:text-primary-700 underline underline-offset-4"
              >
                Acquista il corso
              </Link>
            </p>
          </div>
        </div>
      </div>
      
      {/* Right Column: Image */}
      <div className="hidden lg:block lg:w-1/2 relative bg-primary-50">
        <img 
          src="/login-beauty.webp" 
          alt="Microblading Masterclass" 
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Un leggero overlay per renderla ancora più elegante e smorzare i contrasti */}
        <div className="absolute inset-0 bg-primary-950/10 mix-blend-multiply"></div>
      </div>
    </div>
  );
};