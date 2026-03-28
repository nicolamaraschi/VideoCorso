import { createContext } from 'react';
import type { AuthUser } from '../../types';

export interface AuthActionResult {
  success: boolean;
  error?: string;
  user?: AuthUser | null;
}

export interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<AuthActionResult>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  newPasswordRequired: boolean;
  completeNewPassword: (newPassword: string) => Promise<AuthActionResult>;
  sendPasswordResetCode: (email: string) => Promise<AuthActionResult>;
  submitPasswordReset: (
    email: string,
    confirmationCode: string,
    newPassword: string
  ) => Promise<AuthActionResult>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
