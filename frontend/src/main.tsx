import React from 'react';
import ReactDOM from 'react-dom/client';
import { Amplify } from 'aws-amplify';
import App from './App';
import './index.css';
import { AuthProvider } from './components/auth/AuthContext.tsx'; 
import { BrowserRouter as Router } from 'react-router-dom'; 

// Log environment variables (non critiche per sicurezza)
console.log('Env config check:', {
  hasUserPoolId: !!import.meta.env.VITE_COGNITO_USER_POOL_ID,
  hasClientId: !!import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID,
  hasApiUrl: !!import.meta.env.VITE_API_BASE_URL,
  region: import.meta.env.VITE_AWS_REGION,
  // Includi anche le variabili REACT_APP_ per debug
  hasReactAppUserPoolId: !!import.meta.env.REACT_APP_USER_POOL_ID,
  hasReactAppClientId: !!import.meta.env.REACT_APP_USER_POOL_CLIENT_ID,
  hasReactAppApiEndpoint: !!import.meta.env.REACT_APP_API_ENDPOINT,
});

// Abilita logging a livello globale (compatibile con qualsiasi versione di Amplify)
if (process.env.NODE_ENV !== 'production') {
  console.log('Enabling Amplify debug logging');
  // @ts-ignore - Utilizzo un approccio più generico per abilitare i log
  window.LOG_LEVEL = 'DEBUG';
}

// Configura AWS Amplify
Amplify.configure({
  Auth: {
    Cognito: {
      // Prova a usare sia le variabili VITE_ che REACT_APP_
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || 
                import.meta.env.REACT_APP_USER_POOL_ID || '',
      userPoolClientId: import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID || 
                      import.meta.env.REACT_APP_USER_POOL_CLIENT_ID || '',
      identityPoolId: import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID || '',
    },
  },
  // Nessuna configurazione di logging qui che potrebbe causare errori
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