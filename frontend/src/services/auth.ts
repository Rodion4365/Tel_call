import { apiClient } from "./apiClient";
import { getTelegramWebApp } from "./telegram";
import type { AuthResponse } from "../types/auth";

export const authorizeTelegram = async (): Promise<AuthResponse> => {
  const webApp = getTelegramWebApp();

  if (!webApp) {
    // eslint-disable-next-line no-console
    console.error("[Auth] Telegram WebApp is not available");
    throw new Error("Telegram WebApp is not available");
  }

  const initData = webApp.initData;

  if (!initData || initData.trim() === "") {
    // eslint-disable-next-line no-console
    console.error("[Auth] Telegram initData is missing or empty", {
      hasWebApp: !!webApp,
      initData: initData,
      initDataUnsafe: webApp.initDataUnsafe,
    });
    webApp?.showAlert?.(
      "Не удалось получить данные авторизации от Telegram. Попробуйте перезапустить приложение.",
    );
    throw new Error("Telegram initData is missing or empty");
  }

  // eslint-disable-next-line no-console
  console.log("[Auth] Sending auth request with initData");

  return apiClient.post<AuthResponse>("/auth/telegram", {
    initData,
  });
};
