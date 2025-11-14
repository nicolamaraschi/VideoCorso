// frontend/src/hooks/useAuth.ts

import { useState, useEffect } from 'react';
import { getCurrentUser, signIn, signOut, fetchAuthSession } from 'aws-amplify/auth';
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
      console.log('Checking user...');
      
      const currentUser = await getCurrentUser();
      console.log('Current user found:', currentUser);
      
      const session = await fetchAuthSession();
      console.log('Auth session retrieved:', session.tokens ? 'Has tokens' : 'No tokens');

      // Prendi gli attributi dal token
      const idToken = session.tokens?.idToken;
      const attributes = idToken?.payload;
      
      if (attributes) {
        console.log('User attributes found in token:', 
          Object.keys(attributes).filter(k => !k.startsWith('_')));
      }

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
        
        subscriptionEndDate:
          (attributes?.['custom:sub_end_date'] as string) || '', 
          
        total_watch_time:
          parseFloat(attributes?.['custom:total_watch_time'] as string || '0'),
      };

      console.log('User authenticated:', authUser.email, authUser.isAdmin ? '(admin)' : '');
      setUser(authUser);
      setError(null);
    } catch (err) {
      console.log('No authenticated user found:', err);
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
      console.log(`Signing in with email: ${email}`);

      await signIn({
        username: email,
        password,
      });

      console.log('Sign in successful, checking user...');
      await checkUser(); // Ricarica i dati utente dopo il login
      return { success: true };
    } catch (err: any) {
      console.error('Login failed:', err);
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
      console.log('Signing out...');
      await signOut();
      setUser(null);
      setError(null);
      console.log('Sign out successful');
    } catch (err: any) {
      console.error('Logout failed:', err);
      setError(err.message || 'Failed to logout');
    } finally {
      setLoading(false);
    }
  };

  const refreshUser = async () => {
    console.log('Refreshing user...');
    await checkUser();
  };

  return {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    isAdmin: !!user?.isAdmin,
    login,
    logout,
    refreshUser,
  };
};