import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getTelegramWebApp } from "../services/telegram";
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
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null);
  const [isReady, setReady] = useState(false);
  const hasNavigated = useRef(false);

  useEffect(() => {
    const telegramApp = getTelegramWebApp();

    if (!telegramApp) {
      return;
    }

    telegramApp.ready();
    telegramApp.expand?.();
    setWebApp(telegramApp);
    setReady(true);

    const startParam = telegramApp.initDataUnsafe?.start_param;

    if (
      startParam &&
      !hasNavigated.current &&
      location.pathname !== `/call/${startParam}`
    ) {
      hasNavigated.current = true;
      navigate(`/call/${startParam}`, { replace: true });
    }
  }, [location.pathname, navigate]);

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
