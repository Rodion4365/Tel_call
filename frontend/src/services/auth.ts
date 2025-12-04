import { apiClient } from "./apiClient";
import { getTelegramWebApp } from "./telegram";
import type { AuthResponse } from "../types/auth";
import { logger } from "../utils/logger";

export const authorizeTelegram = async (): Promise<AuthResponse> => {
  const webApp = getTelegramWebApp();
  const initData = webApp?.initData ?? "";

  if (!initData) {
    logger.error("Telegram init data is missing");
    webApp?.showAlert?.("Не удалось получить данные Telegram");
    throw new Error("Telegram init data is missing");
  }

  return apiClient.post<AuthResponse>("/auth/telegram", {
    initData,
  });
};
