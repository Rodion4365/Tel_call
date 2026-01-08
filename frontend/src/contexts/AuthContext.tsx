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
import { setUnauthorizedHandler } from "../services/apiClient";
import type { AuthUser } from "../types/auth";

export const AUTH_STORAGE_KEY = "telegram-auth-v2";

export interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
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
  const [token, setToken] = useState<string | null>(null);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [hasTriedAuth, setHasTriedAuth] = useState(false);

  // Restore auth from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as { token: string; user: AuthUser };
        setToken(parsed.token);
        setUser(parsed.user);
      } catch (error) {
        console.error("[Auth] failed to parse stored auth", error);
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    }
  }, []);

  const clearAuth = useCallback(() => {
    setUser(null);
    setToken(null);
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

    // eslint-disable-next-line no-console
    console.log("[Auth] start Telegram authorization");

    try {
      const response = await authorizeTelegram();
      setUser(response.user);
      setToken(response.access_token);

      // Store in localStorage for Telegram Mini Apps where cookies may not work
      localStorage.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify({
          token: response.access_token,
          user: response.user,
        }),
      );

      // eslint-disable-next-line no-console
      console.log("[Auth] success - token stored", response.user);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[Auth] failed to authorize Telegram user", error);
      setAuthError("Не удалось авторизоваться через Telegram");
      getTelegramWebApp()?.showAlert?.("Не удалось авторизоваться через Telegram");
    } finally {
      setIsAuthorizing(false);
    }
  }, [isAuthorizing]);

  // Register handler for automatic reauth on 401 errors
  useEffect(() => {
    setUnauthorizedHandler(async () => {
      // eslint-disable-next-line no-console
      console.log("[Auth] Token expired, clearing and re-authorizing");
      clearAuth();
      await loginWithTelegram();
    });
  }, [clearAuth, loginWithTelegram]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
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
