import React from 'react';
import { Link } from 'react-router-dom';
import { LoginForm } from '../components/auth/LoginForm';

export const LoginPage: React.FC = () => {
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
          src="/login-beauty.png" 
          alt="Microblading Masterclass" 
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Un leggero overlay per renderla ancora più elegante e smorzare i contrasti */}
        <div className="absolute inset-0 bg-primary-950/10 mix-blend-multiply"></div>
      </div>
    </div>
  );
};