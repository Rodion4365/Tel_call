/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { authorizeTelegram } from "../services/auth";
import { getTelegramWebApp } from "../services/telegram";
import type { AuthUser } from "../types/auth";

export interface AuthContextValue {
  user: AuthUser | null;
  isAuthorizing: boolean;
  authError: string | null;
  hasTriedAuth: boolean;
  loginWithTelegram: () => Promise<void>;
  clearAuth: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [hasTriedAuth, setHasTriedAuth] = useState(false);

  const clearAuth = useCallback(() => {
    setUser(null);
    setAuthError(null);
    setHasTriedAuth(false);
    // Token is in httpOnly cookie, cleared by backend on logout
  }, []);

  const loginWithTelegram = useCallback(async () => {
    if (isAuthorizing) {
      return;
    }

    setIsAuthorizing(true);
    setAuthError(null);
    setHasTriedAuth(true);

    // eslint-disable-next-line no-console
    console.log("[Auth] start Telegram authorization");

    try {
      const response = await authorizeTelegram();
      setUser(response.user);

      // eslint-disable-next-line no-console
      console.log("[Auth] success - token stored in httpOnly cookie", response.user);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[Auth] failed to authorize Telegram user", error);
      setAuthError("Не удалось авторизоваться через Telegram");
      getTelegramWebApp()?.showAlert?.("Не удалось авторизоваться через Telegram");
    } finally {
      setIsAuthorizing(false);
    }
  }, [isAuthorizing]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthorizing,
      authError,
      hasTriedAuth,
      loginWithTelegram,
      clearAuth,
    }),
    [authError, clearAuth, hasTriedAuth, isAuthorizing, loginWithTelegram, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
};
