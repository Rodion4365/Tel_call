import type { TelegramWebApp } from "../types/telegram";

const getTelegramWebApp = (): TelegramWebApp | undefined => {
  return (window as any).Telegram?.WebApp as TelegramWebApp | undefined;
};

export const initTelegramWebApp = (): TelegramWebApp | undefined => {
  const webApp = getTelegramWebApp();

  if (webApp) {
    webApp.ready();
    webApp.expand?.();
  }

  return webApp;
};

export const isTelegram = (): boolean => Boolean(getTelegramWebApp());

export const getTelegramUser = () => getTelegramWebApp()?.initDataUnsafe?.user;
