// frontend/src/hooks/useAuth.ts

import { useState, useEffect } from 'react';
import { getCurrentUser, signIn, signOut, fetchAuthSession, confirmSignIn } from 'aws-amplify/auth';
import type { AuthUser } from '../types';

export const useAuth = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newPasswordRequired, setNewPasswordRequired] = useState(false);
  const [tempUser, setTempUser] = useState<any>(null);

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

      const idToken = session.tokens?.idToken;
      const attributes = idToken?.payload;
      
      if (attributes) {
        console.log('User attributes found in token');
      }

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

      console.log('User authenticated:', authUser);
      setUser(authUser);
      setError(null);
    } catch (err) {
      console.log('No authenticated user found:', err);
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

      const signInResult = await signIn({ username: email, password });
      console.log('Sign in result:', signInResult);
      
      // Gestione caso NEW_PASSWORD_REQUIRED
      if (signInResult.nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD') {
        console.log('New password required');
        setNewPasswordRequired(true);
        setTempUser(signInResult);
        return { 
          success: false, 
          error: 'È necessario cambiare la password. Contatta l\'amministratore.' 
        };
      }

      console.log('Sign in successful, checking user...');
      await checkUser();
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

  const completeNewPassword = async (newPassword: string) => {
    try {
      setLoading(true);
      if (!tempUser) {
        return { success: false, error: 'No authentication in progress' };
      }

      console.log('Confirming sign in with new password');
      await confirmSignIn({ challengeResponse: newPassword });
      
      await checkUser();
      setNewPasswordRequired(false);
      setTempUser(null);
      return { success: true };
    } catch (err: any) {
      console.error('Change password failed:', err);
      return { success: false, error: err.message };
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
    newPasswordRequired,
    login,
    completeNewPassword,
    logout,
    refreshUser,
  };
};