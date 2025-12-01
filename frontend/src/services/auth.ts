import { apiClient } from "./apiClient";
import type { AuthResponse } from "../types/auth";

export const authorizeTelegram = async (initData: string): Promise<AuthResponse> => {
  return apiClient.post<AuthResponse>("/auth/telegram", {
    initData,
  });
};
