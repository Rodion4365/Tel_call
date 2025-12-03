import { authorizeTelegram } from "./auth";
import { getTelegramWebApp } from "./telegram";
import type { AuthResponse } from "../types/auth";

const INIT_DATA_ERROR_MESSAGE = "Не удалось получить данные Telegram";

export const authorizeWithTelegram = async (): Promise<AuthResponse> => {
  const webApp = getTelegramWebApp();
  const initData = webApp?.initData?.trim();

  if (!initData) {
    // eslint-disable-next-line no-console
    console.error(INIT_DATA_ERROR_MESSAGE);
    webApp?.showAlert?.(INIT_DATA_ERROR_MESSAGE);
    throw new Error(INIT_DATA_ERROR_MESSAGE);
  }

  try {
    return await authorizeTelegram(initData);
  } catch (error) {
    webApp?.showAlert?.("Ошибка авторизации. Попробуйте снова.");
    throw error;
  }
};
