import { useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useWebAppConnection } from "../contexts/WebAppConnectionContext";
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
  const { webApp, startParam, isReady } = useWebAppConnection();
  const hasNavigated = useRef(false);

  useEffect(() => {
    if (
      !isReady ||
      !startParam ||
      hasNavigated.current ||
      location.pathname === `/call/${startParam}`
    ) {
      return;
    }

    hasNavigated.current = true;
    navigate(`/call/${startParam}`, { replace: true });
  }, [isReady, location.pathname, navigate, startParam]);

  return useMemo(
    () => ({
      webApp,
      user: webApp?.initDataUnsafe?.user,
      startParam,
      isReady,
    }),
    [isReady, startParam, webApp],
  );
};
