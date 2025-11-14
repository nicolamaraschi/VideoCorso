import React from 'react';
import ReactDOM from 'react-dom/client';
import { Amplify } from 'aws-amplify';
import App from './App';
import './index.css';
import { AuthProvider } from './components/auth/AuthContext.tsx';
import { BrowserRouter as Router } from 'react-router-dom';

// Log environment variables (non critiche per sicurezza)
console.log('Env config check:', {
  VITE_COGNITO_USER_POOL_ID: import.meta.env.VITE_COGNITO_USER_POOL_ID || 'NOT SET',
  VITE_COGNITO_USER_POOL_CLIENT_ID: import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID || 'NOT SET',
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'NOT SET',
  VITE_AWS_REGION: import.meta.env.VITE_AWS_REGION || 'NOT SET',
});

// Abilita logging a livello globale
if (process.env.NODE_ENV !== 'production') {
  console.log('Enabling Amplify debug logging');
  // @ts-ignore
  window.LOG_LEVEL = 'DEBUG';
}

// Configura AWS Amplify
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || '',
      userPoolClientId: import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID || '',
      // identityPoolId: import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID || '', // <-- RIMOSSA QUESTA RIGA
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router>
      <AuthProvider>
        <App />
      </AuthProvider>
    </Router>
  </React.StrictMode>
);