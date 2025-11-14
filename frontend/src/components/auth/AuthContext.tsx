import React, { createContext, useContext, type ReactNode } from 'react';
import { useAuth } from '../../hooks/useAuth';
import type { AuthUser } from '../../types';

// Definiamo cosa conterrà il nostro Context
interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  
  // FIX: Aggiunte le proprietà mancanti all'interfaccia
  newPasswordRequired: boolean;
  completeNewPassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  sendPasswordResetCode: (email: string) => Promise<{ success: boolean; error?: string }>;
  submitPasswordReset: (email: string, confirmationCode: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
}

// Creiamo il Context
const AuthContext = createContext<AuthContextType>(null as any);

/**
 * Questo è il Provider che avvolgerà la nostra App in main.tsx.
 * Utilizza il tuo hook useAuth originale per ottenere i dati
 * e li fornisce a tutti i componenti figli.
 */
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const auth = useAuth(); // Il tuo hook originale fa tutto il lavoro

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Questo è il nuovo hook "comodissimo" che useremo
 * in tutti i componenti (Navbar, ProtectedRoute, ecc.)
 * per accedere ai dati dell'utente, senza dover importare 'useAuth'.
 */
export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};