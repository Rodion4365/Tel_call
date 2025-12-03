/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { authorizeWithTelegram } from "../services/telegramAuth";
import type { AuthUser } from "../types/auth";

export type AuthStatus = "idle" | "authorizing" | "authorized" | "error";

export interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  status: AuthStatus;
  error: string | null;
  loginWithTelegram: () => Promise<AuthUser | null>;
  clearAuth: () => void;
}

const AUTH_TOKEN_KEY = "tel_call_auth_token";
const AUTH_USER_KEY = "tel_call_auth_user";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const loadStoredUser = (): AuthUser | null => {
  try {
    const storedUser = localStorage.getItem(AUTH_USER_KEY);
    return storedUser ? (JSON.parse(storedUser) as AuthUser) : null;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to parse stored user", error);
    return null;
  }
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(AUTH_TOKEN_KEY));
  const [user, setUser] = useState<AuthUser | null>(loadStoredUser);
  const [status, setStatus] = useState<AuthStatus>(() =>
    token && user ? "authorized" : "idle",
  );
  const [error, setError] = useState<string | null>(null);

  const persistAuth = useCallback((newToken: string, newUser: AuthUser) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem(AUTH_TOKEN_KEY, newToken);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(newUser));
  }, []);

  const clearAuth = useCallback(() => {
    setToken(null);
    setUser(null);
    setStatus("idle");
    setError(null);
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
  }, []);

  const loginWithTelegram = useCallback(async (): Promise<AuthUser | null> => {
    if (status === "authorized" && token && user) {
      return user;
    }

    setStatus("authorizing");
    setError(null);

    try {
      const response = await authorizeWithTelegram();
      persistAuth(response.access_token, response.user);
      setStatus("authorized");
      return response.user;
    } catch (authError) {
      // eslint-disable-next-line no-console
      console.error("Telegram authorization failed", authError);
      const message =
        authError instanceof Error ? authError.message : "Ошибка авторизации";
      setError(message);
      setStatus("error");
      return null;
    }
  }, [persistAuth, status, token, user]);

  const value = useMemo<AuthContextValue>(
    () => ({ token, user, status, error, loginWithTelegram, clearAuth }),
    [clearAuth, error, loginWithTelegram, status, token, user],
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
