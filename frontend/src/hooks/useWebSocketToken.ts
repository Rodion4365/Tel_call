import { useCallback } from "react";
import { apiClient } from "../services/apiClient";

interface WebSocketTokenResponse {
  token: string;
}

export const useWebSocketToken = () => {
  const getToken = useCallback(async (): Promise<string> => {
    const response = await apiClient.get<WebSocketTokenResponse>("/auth/ws-token");
    return response.token;
  }, []);

  return { getToken };
};
