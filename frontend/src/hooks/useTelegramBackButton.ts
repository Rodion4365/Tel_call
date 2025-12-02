import { useEffect } from "react";
import { TelegramWebApp } from "../types/telegram";

const isBackButtonSupported = (webApp: TelegramWebApp | null): boolean => {
  if (!webApp) {
    return false;
  }

  if (typeof webApp.isVersionAtLeast === "function") {
    return webApp.isVersionAtLeast("6.1");
  }

  if (!webApp.version) {
    return Boolean(webApp.BackButton);
  }

  const toNumbers = (version: string) =>
    version.split(".").map((part) => Number.parseInt(part, 10) || 0);

  const [major, minor, patch] = toNumbers(webApp.version);
  const [requiredMajor, requiredMinor, requiredPatch] = toNumbers("6.1.0");

  if (major !== requiredMajor) {
    return major > requiredMajor;
  }

  if (minor !== requiredMinor) {
    return minor > requiredMinor;
  }

  return patch >= requiredPatch;
};

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
    const isSupported = isBackButtonSupported(webApp);
    const backButton = webApp?.BackButton;

    if (!isSupported || !backButton) {
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
