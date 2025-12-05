import { AUTH_STORAGE_KEY } from "../contexts/AuthContext";

export interface ApiRequestOptions {
  headers?: Record<string, string>;
}

// URL бэкенда по умолчанию
const DEFAULT_API_BASE_URL = "https://www.callwith.ru";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;

// eslint-disable-next-line no-console
console.log("[apiClient] API_BASE_URL =", API_BASE_URL);

const getAuthHeaders = (): Record<string, string> => {
  const stored = localStorage.getItem(AUTH_STORAGE_KEY);
  // eslint-disable-next-line no-console
  console.log("[apiClient] getAuthHeaders - stored:", !!stored, stored ? stored.substring(0, 50) + "..." : "null");

  if (stored) {
    try {
      const parsed = JSON.parse(stored) as { token: string };
      const hasToken = !!parsed.token;
      // eslint-disable-next-line no-console
      console.log("[apiClient] getAuthHeaders - hasToken:", hasToken, parsed.token ? parsed.token.substring(0, 20) + "..." : "null");
      return { Authorization: `Bearer ${parsed.token}` };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[apiClient] failed to parse stored auth", error);
    }
  }
  // eslint-disable-next-line no-console
  console.log("[apiClient] getAuthHeaders - returning empty headers");
  return {};
};

export const apiClient = {
  async get<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    const authHeaders = getAuthHeaders();
    const headers = {
      "Content-Type": "application/json",
      ...authHeaders,
      ...options.headers,
    };

    // eslint-disable-next-line no-console
    console.log("[apiClient.get]", path, "- hasAuth:", !!authHeaders.Authorization);

    const response = await fetch(`${API_BASE_URL}${path}`, {
      credentials: "include", // Send httpOnly cookies automatically
      headers,
    });

    if (!response.ok) {
      // eslint-disable-next-line no-console
      console.error("[apiClient.get] Request failed", path, response.status);
      throw new Error(`Request failed with status ${response.status}`);
    }

    return (await response.json()) as T;
  },

  async post<T>(path: string, body: unknown, options: ApiRequestOptions = {}): Promise<T> {
    const authHeaders = getAuthHeaders();
    const headers = {
      "Content-Type": "application/json",
      ...authHeaders,
      ...options.headers,
    };

    // eslint-disable-next-line no-console
    console.log("[apiClient.post]", path, "- hasAuth:", !!authHeaders.Authorization);

    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      credentials: "include", // Send httpOnly cookies automatically
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      // eslint-disable-next-line no-console
      console.error("[apiClient.post] Request failed", path, response.status);
      throw new Error(`Request failed with status ${response.status}`);
    }

    return (await response.json()) as T;
  },
};
