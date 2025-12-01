import type { TelegramWebApp } from "../types/telegram";

interface TelegramWindow extends Window {
  Telegram?: {
    WebApp?: TelegramWebApp;
  };
}

export const getTelegramWebApp = (): TelegramWebApp | undefined => {
  const telegramWindow = window as TelegramWindow;
  return telegramWindow.Telegram?.WebApp;
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
