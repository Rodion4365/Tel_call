/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { authorizeTelegram } from "../services/auth";
import { getTelegramWebApp } from "../services/telegram";
import type { AuthUser } from "../types/auth";

const AUTH_STORAGE_KEY = "telegram-auth";

export interface AuthContextValue {
  token: string | null;
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

interface StoredAuthData {
  token: string;
  user: AuthUser;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [hasTriedAuth, setHasTriedAuth] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);

    if (!stored) {
      return;
    }

    try {
      const parsed = JSON.parse(stored) as StoredAuthData;
      setToken(parsed.token);
      setUser(parsed.user);
      setHasTriedAuth(true);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to parse stored auth data", error);
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }, []);

  const setAuthData = useCallback((newToken: string, newUser: AuthUser) => {
    setToken(newToken);
    setUser(newUser);
    setHasTriedAuth(true);
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({ token: newToken, user: newUser } satisfies StoredAuthData),
    );
  }, []);

  const clearAuth = useCallback(() => {
    setToken(null);
    setUser(null);
    setAuthError(null);
    setHasTriedAuth(false);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }, []);

  const loginWithTelegram = useCallback(async () => {
    if (isAuthorizing) {
      return;
    }

    setIsAuthorizing(true);
    setAuthError(null);
    setHasTriedAuth(true);

    try {
      const response = await authorizeTelegram();
      setAuthData(response.access_token, response.user);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to authorize Telegram user", error);
      setAuthError("Не удалось авторизоваться через Telegram");
      getTelegramWebApp()?.showAlert?.("Не удалось авторизоваться через Telegram");
    } finally {
      setIsAuthorizing(false);
    }
  }, [isAuthorizing, setAuthData]);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      isAuthorizing,
      authError,
      hasTriedAuth,
      loginWithTelegram,
      clearAuth,
    }),
    [authError, clearAuth, hasTriedAuth, isAuthorizing, loginWithTelegram, token, user],
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
