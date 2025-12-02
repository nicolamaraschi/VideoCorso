import { useState, useEffect } from 'react';
import { 
  getCurrentUser, 
  signIn, 
  signOut, 
  fetchAuthSession, 
  confirmSignIn,
  resetPassword,
  confirmResetPassword 
} from 'aws-amplify/auth';
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

  const checkUser = async (): Promise<AuthUser | null> => {
    try {
      setLoading(true);
      
      const currentUser = await getCurrentUser();
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken;
      const attributes = idToken?.payload;
      
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

      setUser(authUser);
      setError(null);
      return authUser;
    } catch (err) {
      console.log('No authenticated user found:', err);
      setUser(null);
      setError(null); 
      return null;
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);

      const signInResult = await signIn({ username: email, password });
      
      const isNewPasswordRequired = 
        signInResult.nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED';

      if (isNewPasswordRequired) {
        setNewPasswordRequired(true);
        setTempUser(signInResult);
        return { success: true }; 
      }

      const loggedUser = await checkUser();
      return { success: true, user: loggedUser }; 

    } catch (err: any) {
      console.error('Login failed:', err);
      
      let errorMessage = 'Si è verificato un errore durante l\'accesso.';

      // Estrazione sicura del nome dell'errore
      const errorName = err.name || (err.__type ? err.__type.split('#').pop() : '');
      const errorMsg = err.message || '';

      console.log('Error Name:', errorName); // Debug
      console.log('Error Message:', errorMsg); // Debug

      switch (errorName) {
        case 'NotAuthorizedException':
          errorMessage = 'Email o password errati. Riprova.';
          break;
        case 'UserNotFoundException':
          errorMessage = 'Email o password errati. Riprova.';
          break;
        case 'UserNotConfirmedException':
          errorMessage = 'Il tuo account non è stato ancora confermato. Controlla la tua email.';
          break;
        case 'LimitExceededException':
          errorMessage = 'Troppi tentativi di accesso. Attendi qualche minuto e riprova.';
          break;
        case 'TooManyRequestsException':
           errorMessage = 'Troppe richieste al server. Riprova tra poco.';
           break;
        default:
          // Gestione specifica per il messaggio che hai incollato
          if (errorMsg.includes("Incorrect username or password")) {
             errorMessage = 'Email o password errati. Riprova.';
          } else if (errorMsg) {
             errorMessage = errorMsg;
          }
      }
      
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
        return { success: false, error: 'Sessione scaduta. Effettua nuovamente il login.' };
      }

      await confirmSignIn({ challengeResponse: newPassword });
      
      const loggedUser = await checkUser();
      setNewPasswordRequired(false);
      setTempUser(null);
      
      return { success: true, user: loggedUser }; 
    } catch (err: any) {
      console.error('Change password failed:', err);
      const msg = err.message || 'Impossibile impostare la password.';
      setError(msg);
      return { success: false, error: msg };
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
      console.error('Logout failed:', err);
      setError(err.message || 'Errore durante il logout');
    } finally {
      setLoading(false);
    }
  };

  const refreshUser = async () => {
    await checkUser();
  };
  
  const sendPasswordResetCode = async (email: string) => {
    try {
      setLoading(true);
      setError(null);
      await resetPassword({ username: email });
      setLoading(false);
      return { success: true };
    } catch (err: any) {
      setLoading(false);
      console.error('Send reset code failed:', err);
      let msg = "Impossibile inviare il codice. Controlla l'email e riprova.";
      if (err.name === 'LimitExceededException') msg = "Troppi tentativi. Riprova più tardi.";
      if (err.name === 'UserNotFoundException') msg = "Nessun account trovato con questa email.";
      
      setError(msg);
      return { success: false, error: msg };
    }
  };
  
  const submitPasswordReset = async (email: string, confirmationCode: string, newPassword: string) => {
    try {
      setLoading(true);
      setError(null);
      await confirmResetPassword({ username: email, confirmationCode, newPassword });
      setLoading(false);
      return { success: true };
    } catch (err: any) {
      setLoading(false);
      console.error('Submit reset failed:', err);
      let msg = "Errore nel reset della password.";
      if (err.name === 'CodeMismatchException') msg = "Il codice inserito non è valido.";
      if (err.name === 'ExpiredCodeException') msg = "Il codice è scaduto. Richiedine uno nuovo.";
      if (err.name === 'InvalidPasswordException') msg = "La password non rispetta i requisiti di sicurezza.";
      
      setError(msg);
      return { success: false, error: msg };
    }
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
    sendPasswordResetCode,
    submitPasswordReset,
  };
};