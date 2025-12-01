import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { authorizeTelegram } from "../services/auth";
import type { TelegramWebApp, TelegramWebAppUser } from "../types/telegram";

interface UseTelegramWebAppResult {
  webApp: TelegramWebApp | null;
  user: TelegramWebAppUser | undefined;
  startParam: string | undefined;
  isReady: boolean;
}

export const useTelegramWebApp = (): UseTelegramWebAppResult => {
  const navigate = useNavigate();
  const location = useLocation();
  const { token, setAuthData } = useAuth();
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null);
  const [isReady, setReady] = useState(false);
  const hasAuthorized = useRef(false);
  const hasNavigated = useRef(false);

  useEffect(() => {
    const telegramApp = (window as any).Telegram?.WebApp as TelegramWebApp | undefined;

    if (!telegramApp) {
      return;
    }

    telegramApp.ready();
    telegramApp.expand?.();
    setWebApp(telegramApp);
    setReady(true);

    if (telegramApp.initData && !hasAuthorized.current && !token) {
      hasAuthorized.current = true;

      authorizeTelegram(telegramApp.initData)
        .then((response) => {
          setAuthData(response.access_token, response.user);
        })
        .catch((error) => {
          // eslint-disable-next-line no-console
          console.error("Failed to authorize Telegram user", error);
        });
    }

    const startParam = telegramApp.initDataUnsafe?.start_param;

    if (
      startParam &&
      !hasNavigated.current &&
      location.pathname !== `/call/${startParam}`
    ) {
      hasNavigated.current = true;
      navigate(`/call/${startParam}`, { replace: true });
    }
  }, [location.pathname, navigate, setAuthData, token]);

  return useMemo(
    () => ({
      webApp,
      user: webApp?.initDataUnsafe?.user,
      startParam: webApp?.initDataUnsafe?.start_param,
      isReady,
    }),
    [isReady, webApp],
  );
};
