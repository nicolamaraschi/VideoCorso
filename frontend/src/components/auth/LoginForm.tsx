import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, AlertCircle, KeyRound, CheckCircle } from 'lucide-react';
import { Button } from '../common/Button';
import { useAuthContext } from './useAuthContext';
import { validateEmail } from '../../utils/validators';
import type { AuthUser } from '../../types';

export const LoginForm: React.FC = () => {
  type View = 'login' | 'forgot' | 'reset';
  const [view, setView] = useState<View>('login');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [code, setCode] = useState('');
  
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

  const handleRedirect = (user?: AuthUser | null) => {
    if (user?.isAdmin) {
      navigate('/admin');
    } else {
      navigate('/dashboard');
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      if (!newPasswordRequired) {
        if (!email || !password) {
          setError('Per favore compila tutti i campi');
          setLoading(false);
          return;
        }

        if (!validateEmail(email)) {
          setError('Per favore inserisci un indirizzo email valido');
          setLoading(false);
          return;
        }
        
        const result = await login(email, password);
        
        if (result.success && !newPasswordRequired) { 
          handleRedirect(result.user); 
        } else if (!result.success) {
          // FIX: Assicuriamoci che l'errore venga settato
          // Se result.error è vuoto, mettiamo un messaggio di default
          setError(result.error || 'Credenziali non valide. Riprova.');
        }

      } else {
        if (!newPassword) {
          setError('Per favore inserisci la tua nuova password');
          setLoading(false);
          return;
        }
        
        const result = await completeNewPassword(newPassword);
        
        if (result.success) {
          handleRedirect(result.user);
        } else {
          setError(result.error || 'Impossibile impostare la password');
        }
      }
    } catch (err) {
      console.error('Login form error:', err);
      setError('Si è verificato un errore imprevisto.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    
    if (!validateEmail(email)) {
      setError('Per favore inserisci un indirizzo email valido');
      return;
    }

    setLoading(true);
    const result = await sendPasswordResetCode(email);
    setLoading(false);

    if (result.success) {
      setMessage('Successo! Controlla la tua email per il codice di verifica.');
      setView('reset');
    } else {
      setError(result.error || 'Impossibile inviare il codice di reset.');
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!code || !newPassword) {
      setError('Per favore compila tutti i campi');
      return;
    }

    setLoading(true);
    const result = await submitPasswordReset(email, code, newPassword);
    setLoading(false);

    if (result.success) {
      setMessage('Password reimpostata con successo! Accedi con la nuova password.');
      setView('login');
      setPassword(''); 
      setNewPassword('');
      setCode('');
    } else {
      setError(result.error || 'Impossibile reimpostare la password.');
    }
  };

  // Funzione helper per mostrare messaggi
  const renderMessages = () => (
    <>
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg mb-4 animate-fade-in">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700 font-medium">{error}</p>
        </div>
      )}
      {message && (
        <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg mb-4 animate-fade-in">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
          <p className="text-sm text-green-700 font-medium">{message}</p>
        </div>
      )}
    </>
  );

  if (newPasswordRequired) {
    return (
      <form onSubmit={handleLoginSubmit} className="space-y-6">
        {renderMessages()}
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900">Imposta Nuova Password</h2>
          <p className="text-sm text-gray-600">Benvenuto! Imposta una nuova password per il tuo account.</p>
        </div>
        <div>
          <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
            Nuova Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
              autoComplete="new-password"
            />
          </div>
        </div>
        <Button type="submit" variant="primary" fullWidth loading={loading}>
          Imposta Password e Accedi
        </Button>
      </form>
    );
  }

  if (view === 'forgot') {
    return (
      <form onSubmit={handleForgotSubmit} className="space-y-6">
        {renderMessages()}
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900">Password Dimenticata?</h2>
          <p className="text-sm text-gray-600">Inserisci la tua email per ricevere un codice di reset.</p>
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
            Indirizzo Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tua@email.com"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
              autoComplete="email"
            />
          </div>
        </div>
        <Button type="submit" variant="primary" fullWidth loading={loading}>
          Invia Codice Reset
        </Button>
        <Button variant="ghost" fullWidth onClick={() => { setView('login'); setError(''); }}>
          Torna al Login
        </Button>
      </form>
    );
  }

  if (view === 'reset') {
    return (
      <form onSubmit={handleResetSubmit} className="space-y-6">
        {renderMessages()}
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900">Reimposta Password</h2>
          <p className="text-sm text-gray-600">Inserisci il codice inviato a {email} e la tua nuova password.</p>
        </div>
        <div>
          <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-2">
            Codice di Verifica
          </label>
          <div className="relative">
            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              id="code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
            />
          </div>
        </div>
        <div>
          <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
            Nuova Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
              autoComplete="new-password"
            />
          </div>
        </div>
        <Button type="submit" variant="primary" fullWidth loading={loading}>
          Imposta Nuova Password
        </Button>
        <Button variant="ghost" fullWidth onClick={() => { setView('login'); setError(''); }}>
          Torna al Login
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={handleLoginSubmit} className="space-y-6">
      {renderMessages()}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
          Indirizzo Email
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tua@email.com"
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
          Password dimenticata?
        </button>
      </div>

      <Button type="submit" variant="primary" fullWidth loading={loading}>
        Accedi
      </Button>
    </form>
  );
};
