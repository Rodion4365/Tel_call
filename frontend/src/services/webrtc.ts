import { apiClient } from "./apiClient";

export interface WebRtcConfigResponse {
  stun_servers: string[];
  turn_servers: string[];
}

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

export const getWebSocketBaseUrl = (): string => {
  const baseUrl =
    import.meta.env.VITE_WS_BASE_URL ||
    import.meta.env.VITE_API_BASE_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");

  const normalized = baseUrl?.replace(/\/$/, "");

  if (!normalized) {
    return "";
  }

  return normalized.startsWith("ws") ? normalized : normalized.replace(/^http/, "ws");
};

export const fetchIceServers = async (): Promise<RTCIceServer[]> => {
  try {
    const response = await apiClient.get<WebRtcConfigResponse>("/api/config/webrtc");
    const servers: RTCIceServer[] = [
      ...response.stun_servers.map((url) => ({ urls: url })),
      ...response.turn_servers.map((url) => ({ urls: url })),
    ];

    return servers.length ? servers : DEFAULT_ICE_SERVERS;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to load ICE servers", error);
    return DEFAULT_ICE_SERVERS;
  }
};
