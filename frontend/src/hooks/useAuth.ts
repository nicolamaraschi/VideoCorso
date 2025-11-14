// frontend/src/hooks/useAuth.ts
// QUESTO È IL CODICE DI PRODUZIONE COMPLETO

import { useState, useEffect } from 'react';
import { getCurrentUser, signIn, signOut, fetchAuthSession } from '@aws-amplify/auth';
import type { AuthUser } from '../types';

export const useAuth = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      setLoading(true);
      const currentUser = await getCurrentUser();
      const session = await fetchAuthSession();

      // Prendi gli attributi dal token
      const idToken = session.tokens?.idToken;
      const attributes = idToken?.payload;

      // Costruisci l'oggetto AuthUser
      const authUser: AuthUser = {
        userId: currentUser.userId,
        email: (attributes?.email as string) || '',
        fullName:
          (attributes?.['custom:full_name'] as string) ||
          (attributes?.name as string) ||
          '',
        isAdmin:
          (attributes?.['cognito:groups'] as string[])?.includes('admin') || false,
        subscriptionStatus:
          (attributes?.['custom:subscription_status'] as string) || 'expired',
        
        // --- CORREZIONE IMPORTANTE ---
        // Ho usato "custom:sub_end_date" come definito nel tuo template.yaml
        subscriptionEndDate:
          (attributes?.['custom:sub_end_date'] as string) || '', 
          
        // Questo attributo è nel tuo tipo 'AuthUser' ma non nel template Cognito.
        // Se lo hai aggiunto a mano, funzionerà, altrimenti sarà 0.
        total_watch_time:
          parseFloat(attributes?.['custom:total_watch_time'] as string || '0'),
      };

      setUser(authUser);
      setError(null);
    } catch (err) {
      // Non è un errore se l'utente non è loggato
      setUser(null);
      setError(null); 
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);

      await signIn({
        username: email,
        password,
      });

      await checkUser(); // Ricarica i dati utente dopo il login
      return { success: true };
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to login';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      await signOut();
      setUser(null);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to logout');
    } finally {
      setLoading(false);
    }
  };

  const refreshUser = async () => {
    await checkUser();
  };

  return {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    isAdmin: user?.isAdmin || false,
    login,
    logout,
    refreshUser,
  };
};