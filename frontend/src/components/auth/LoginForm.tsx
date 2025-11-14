// frontend/src/components/auth/LoginForm.tsx

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, AlertCircle, KeyRound, CheckCircle } from 'lucide-react'; // Aggiunto CheckCircle
import { Button } from '../common/Button';
import { useAuthContext } from './AuthContext.tsx';
import { validateEmail } from '../../utils/validators';

// L'esportazione 'LoginForm' è qui, quindi l'errore è la cache di Vite
export const LoginForm: React.FC = () => {
  // Stati UI
  type View = 'login' | 'forgot' | 'reset';
  const [view, setView] = useState<View>('login');
  
  // Stati Dati
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [code, setCode] = useState('');
  
  // Stati Generali
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { 
    login, 
    newPasswordRequired, 
    completeNewPassword,
    sendPasswordResetCode,
    submitPasswordReset
  } = useAuthContext();
  
  const navigate = useNavigate();

  // Gestore per il Login o Cambio Password Temporanea
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      if (!newPasswordRequired) {
        // --- 1. Flusso di Login Normale ---
        if (!email || !password) {
          setError('Please fill in all fields');
          setLoading(false);
          return;
        }

        if (!validateEmail(email)) {
          setError('Please enter a valid email address');
          setLoading(false);
          return;
        }
        
        const result = await login(email, password);
        
        if (result.success && !newPasswordRequired) { 
          navigate('/dashboard');
        } else if (!result.success) {
          setError(result.error || 'Login failed. Check your credentials.');
        }

      } else {
        // --- 2. Flusso Nuova Password (dopo il login temporaneo) ---
        if (!newPassword) {
          setError('Please enter your new password');
          setLoading(false);
          return;
        }
        
        const result = await completeNewPassword(newPassword);
        
        if (result.success) {
          navigate('/dashboard');
        } else {
          setError(result.error || 'Failed to set new password');
        }
      }
    } catch (err: any) {
      console.error('Login form error:', err);
      setError(err.message || 'An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  // Gestore per la Richiesta di Reset Password
  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    
    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    const result = await sendPasswordResetCode(email);
    setLoading(false);

    if (result.success) {
      setMessage('Success! Check your email for a verification code.');
      setView('reset'); // Passa alla vista per inserire il codice
    } else {
      setError(result.error || 'Failed to send reset code.');
    }
  };

  // Gestore per l'Invio della Nuova Password
  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!code || !newPassword) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    const result = await submitPasswordReset(email, code, newPassword);
    setLoading(false);

    if (result.success) {
      setMessage('Password reset successfully! Please log in with your new password.');
      setView('login'); // Torna al login
      setPassword(''); 
      setNewPassword('');
      setCode('');
    } else {
      setError(result.error || 'Failed to reset password.');
    }
  };

  // Funzione helper per mostrare messaggi
  const renderMessages = () => (
    <>
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
      {message && (
        <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
          <p className="text-sm text-green-700">{message}</p>
        </div>
      )}
    </>
  );

  // --- 1. Flusso Set Nuova Password (Utente Temporaneo) ---
  if (newPasswordRequired) {
    return (
      <form onSubmit={handleLoginSubmit} className="space-y-6">
        {renderMessages()}
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900">Set New Password</h2>
          <p className="text-sm text-gray-600">Welcome! Please set a new password for your account.</p>
        </div>
        <div>
          <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
            New Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
              required
              autoComplete="new-password"
            />
          </div>
        </div>
        <Button type="submit" variant="primary" fullWidth loading={loading}>
          Set Password and Sign In
        </Button>
      </form>
    );
  }

  // --- 2. Flusso Password Dimenticata (Richiesta Codice) ---
  if (view === 'forgot') {
    return (
      <form onSubmit={handleForgotSubmit} className="space-y-6">
        {renderMessages()}
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900">Forgot Password?</h2>
          <p className="text-sm text-gray-600">Enter your email to receive a reset code.</p>
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
              required
              autoComplete="email"
            />
          </div>
        </div>
        <Button type="submit" variant="primary" fullWidth loading={loading}>
          Send Reset Code
        </Button>
        <Button variant="ghost" fullWidth onClick={() => setView('login')}>
          Back to Sign In
        </Button>
      </form>
    );
  }

  // --- 3. Flusso Password Dimenticata (Invio Codice) ---
  if (view === 'reset') {
    return (
      <form onSubmit={handleResetSubmit} className="space-y-6">
        {renderMessages()}
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900">Reset Your Password</h2>
          <p className="text-sm text-gray-600">Enter the code sent to {email} and your new password.</p>
        </div>
        <div>
          <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-2">
            Verification Code
          </label>
          <div className="relative">
            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              id="code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
              required
            />
          </div>
        </div>
        <div>
          <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
            New Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
              required
              autoComplete="new-password"
            />
          </div>
        </div>
        <Button type="submit" variant="primary" fullWidth loading={loading}>
          Set New Password
        </Button>
        <Button variant="ghost" fullWidth onClick={() => setView('login')}>
          Back to Sign In
        </Button>
      </form>
    );
  }

  // --- 4. Flusso di Login Standard ---
  return (
    <form onSubmit={handleLoginSubmit} className="space-y-6">
      {renderMessages()}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
          Email Address
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
            required
            autoComplete="email"
          />
        </div>
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
          Password
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
            required
            autoComplete="current-password"
          />
        </div>
      </div>
      
      <div className="text-right">
        <button
          type="button"
          onClick={() => {
            setView('forgot');
            setError('');
            setMessage('');
          }}
          className="text-sm font-medium text-primary-600 hover:text-primary-700"
        >
          Forgot password?
        </button>
      </div>

      <Button type="submit" variant="primary" fullWidth loading={loading}>
        Sign In
      </Button>
    </form>
  );
};