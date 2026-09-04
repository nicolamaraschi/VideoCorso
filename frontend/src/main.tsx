import React from 'react';
import ReactDOM from 'react-dom/client';
import { Amplify } from 'aws-amplify';
import App from './App';
import './index.css';
import { AuthProvider } from './components/auth/AuthContext';
import { BrowserRouter as Router } from 'react-router-dom';

declare global {
  interface Window {
    LOG_LEVEL?: string;
  }
}

if (import.meta.env.DEV) {
  window.LOG_LEVEL = 'DEBUG';
}

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || '',
      userPoolClientId: import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID || '',
    },
  },
});

import { reportWebVitals } from './reportWebVitals';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router>
      <AuthProvider>
        <App />
      </AuthProvider>
    </Router>
  </React.StrictMode>
);

reportWebVitals();
