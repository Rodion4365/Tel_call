import React, {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getTelegramWebApp } from "../services/telegram";
import type { TelegramWebApp, TelegramWebAppUser } from "../types/telegram";

export type WebAppStatus = "idle" | "connecting" | "connected" | "error";

interface WebAppConnectionContextValue {
  status: WebAppStatus;
  isReady: boolean;
  webApp: TelegramWebApp | null;
  user: TelegramWebAppUser | undefined;
  startParam: string | undefined;
  retry: () => void;
}

const WebAppConnectionContext = createContext<WebAppConnectionContextValue | null>(null);

export const useWebAppConnection = (): WebAppConnectionContextValue => {
  const context = useContext(WebAppConnectionContext);

  if (!context) {
    throw new Error("useWebAppConnection must be used within WebAppConnectionProvider");
  }

  return context;
};

interface Props {
  children: ReactNode;
}

export const WebAppConnectionProvider: React.FC<Props> = ({ children }) => {
  const [status, setStatus] = useState<WebAppStatus>("idle");
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null);

  useEffect(() => {
    let isMounted = true;

    const initWebApp = async () => {
      try {
        setStatus("connecting");

        const telegramApp = getTelegramWebApp();

        if (!telegramApp) {
          throw new Error("Telegram WebApp is not available");
        }

        telegramApp.ready();
        telegramApp.expand?.();

        // Wait for initData to be available
        // Telegram WebApp needs a short delay for initData to populate
        await new Promise((resolve) => setTimeout(resolve, 100));

        if (!isMounted) return;

        // Verify that initData is available
        if (!telegramApp.initData) {
          throw new Error("Telegram initData is not available");
        }

        setWebApp(telegramApp);
        setStatus("connected");
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to init Telegram WebApp", error);

        if (!isMounted) return;

        setStatus("error");
      }
    };

    void initWebApp();

    return () => {
      isMounted = false;
    };
  }, []);

  const retry = useCallback(() => {
    window.location.reload();
  }, []);

  const value = useMemo<WebAppConnectionContextValue>(
    () => ({
      status,
      isReady: status === "connected",
      webApp,
      user: webApp?.initDataUnsafe?.user,
      startParam: webApp?.initDataUnsafe?.start_param,
      retry,
    }),
    [retry, status, webApp],
  );

  return <WebAppConnectionContext.Provider value={value}>{children}</WebAppConnectionContext.Provider>;
};
