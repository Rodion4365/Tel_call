import { useEffect } from "react";
import { TelegramWebApp } from "../types/telegram";

interface UseTelegramBackButtonOptions {
  webApp: TelegramWebApp | null;
  pathname: string;
  onBack: () => void;
}

export const useTelegramBackButton = ({
  webApp,
  pathname,
  onBack,
}: UseTelegramBackButtonOptions): void => {
  useEffect(() => {
    const backButton = webApp?.BackButton;

    if (!backButton) {
      return undefined;
    }

    const handleBack = () => {
      onBack();
    };

    if (pathname === "/") {
      backButton.hide?.();
      backButton.offClick?.(handleBack);
      return undefined;
    }

    backButton.show?.();
    backButton.onClick?.(handleBack);

    return () => {
      backButton.offClick?.(handleBack);
    };
  }, [onBack, pathname, webApp]);
};
