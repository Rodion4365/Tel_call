import { useCallback } from "react";
import { apiClient } from "../services/apiClient";
import { AUTH_STORAGE_KEY } from "../contexts/AuthContext";

interface WebSocketTokenResponse {
  token: string;
}

export const useWebSocketToken = () => {
  const getToken = useCallback(async (): Promise<string> => {
    // Try to get token from localStorage first (for Telegram Mini Apps)
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as { token: string };
        return parsed.token;
      } catch (error) {
        console.error("[useWebSocketToken] failed to parse stored auth", error);
      }
    }

    // Fallback to API endpoint (for browsers with working cookies)
    const response = await apiClient.get<WebSocketTokenResponse>("/auth/ws-token");
    return response.token;
  }, []);

  return { getToken };
};
