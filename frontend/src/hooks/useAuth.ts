import { useState, useEffect } from 'react';
// Commentiamo le importazioni di Amplify per non chiamare AWS
// import { getCurrentUser, signIn, signOut, fetchAuthSession } from '@aws-amplify/auth';
import type { AuthUser } from '../types';

// --- INIZIO BLOCCO MOCK (DATI FINTI) ---

const MOCK_ADMIN_USER: AuthUser = {
  userId: 'admin-test-id',
  email: 'admin@test.com',
  fullName: 'Admin Tester',
  isAdmin: true,
  subscriptionStatus: 'active',
  subscriptionEndDate: '2099-12-31T00:00:00Z',
  total_watch_time: 1200,
};

const MOCK_STUDENT_USER: AuthUser = {
  userId: 'student-test-id',
  email: 'studente@test.com',
  fullName: 'Studente Tester',
  isAdmin: false,
  subscriptionStatus: 'active',
  subscriptionEndDate: '2025-10-10T00:00:00Z',
  total_watch_time: 360,
};

// *** ISTRUZIONI: DECOMMENTA L'UTENTE CHE VUOI TESTARE ***

// 1. Per testare la Dashboard ADMIN:
//const USER_DA_TESTARE = MOCK_ADMIN_USER;

// 2. Per testare la Dashboard CLIENTE (Studente):
 //const USER_DA_TESTARE = MOCK_STUDENT_USER;
// 3. Per testare da sloggato (Landing Page, Login):
 const USER_DA_TESTARE = null;

// --- FINE BLOCCO MOCK ---


export const useAuth = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // checkUser(); // <-- CODICE ORIGINALE COMMENTATO
    
    // --- INIZIO CODICE MOCK ---
    console.warn("**************************************************");
    console.warn("ATTENZIONE: L'AUTENTICAZIONE È IN MODALITÀ MOCK.");
    console.warn("Ricorda di ripristinare useAuth.ts prima del deploy!");
    console.warn("**************************************************");
    
    // Simula un piccolo caricamento
    setTimeout(() => { 
      setUser(USER_DA_TESTARE);
      setLoading(false);
    }, 500);
    // --- FINE CODICE MOCK ---

  }, []);

  // Le funzioni di login e logout ora simulano solo il cambio di stato
  const login = async (email: string, password: string) => {
    console.log("Login mockato:", email);
    setLoading(true);
    setTimeout(() => {
      // Per il test, facciamo il login come l'utente scelto
      setUser(USER_DA_TESTARE || MOCK_STUDENT_USER); // Fai login come studente se USER_DA_TESTARE è null
      setLoading(false);
    }, 500);
    return { success: true };
  };

  const logout = async () => {
    console.log("Logout mockato");
    setLoading(true);
    setTimeout(() => {
      setUser(null);
      setLoading(false);
    }, 500);
  };

  const refreshUser = async () => {
    console.log("Refresh mockato");
    // Non fa nulla
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

// // -----------------------------------------------------------------
// // 
// //     CODICE ORIGINALE (Da ripristinare prima del deploy)
// // 
// // -----------------------------------------------------------------
//
// import { useState, useEffect } from 'react';
// import { getCurrentUser, signIn, signOut, fetchAuthSession } from '@aws-amplify/auth';
// import type { AuthUser } from '../types';

// export const useAuth = () => {
//   const [user, setUser] = useState<AuthUser | null>(null);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);

//   useEffect(() => {
//     checkUser();
//   }, []);

//   const checkUser = async () => {
//     try {
//       setLoading(true);
//       const currentUser = await getCurrentUser();
//       const session = await fetchAuthSession();

//       // Get user attributes from ID token
//       const idToken = session.tokens?.idToken;
//       const attributes = idToken?.payload;

//       const authUser: AuthUser = {
//         userId: currentUser.userId,
//         email: attributes?.email as string || '',
//         fullName: attributes?.['custom:full_name'] as string || attributes?.name as string || '',
//         isAdmin: (attributes?.['cognito:groups'] as string[])?.includes('admin') || false,
//         subscriptionStatus: attributes?.['custom:subscription_status'] as string || 'expired',
//         subscriptionEndDate: attributes?.['custom:subscription_end_date'] as string || '',
//         // Assicurati che questo attributo esista in Cognito o venga dal tuo DB
//         total_watch_time: parseFloat(attributes?.['custom:total_watch_time'] as string || '0'),
//       };

//       setUser(authUser);
//       setError(null);
//     } catch (err) {
//       setUser(null);
//       setError(null); // Not an error if user is not logged in
//     } finally {
//       setLoading(false);
//     }
//   };

//   const login = async (email: string, password: string) => {
//     try {
//       setLoading(true);
//       setError(null);

//       await signIn({
//         username: email,
//         password,
//       });

//       await checkUser();
//       return { success: true };
//     } catch (err: any) {
//       const errorMessage = err.message || 'Failed to login';
//       setError(errorMessage);
//       return { success: false, error: errorMessage };
//     } finally {
//       setLoading(false);
//     }
//   };

//   const logout = async () => {
//     try {
//       setLoading(true);
//       await signOut();
//       setUser(null);
//       setError(null);
//     } catch (err: any) {
//       setError(err.message || 'Failed to logout');
//     } finally {
//       setLoading(false);
//     }
//   };

//   const refreshUser = async () => {
//     await checkUser();
//   };

//   return {
//     user,
//     loading,
//     error,
//     isAuthenticated: !!user,
//     isAdmin: user?.isAdmin || false,
//     login,
//     logout,
//     refreshUser,
//   };
// };