import { AUTH_STORAGE_KEY } from "../contexts/AuthContext";

export interface ApiRequestOptions {
  headers?: Record<string, string>;
}

// Handler for 401 errors - will be set by AuthContext
let unauthorizedHandler: (() => Promise<void>) | null = null;

export const setUnauthorizedHandler = (handler: () => Promise<void>) => {
  unauthorizedHandler = handler;
};

// URL бэкенда по умолчанию
const DEFAULT_API_BASE_URL = "https://api.callwith.ru";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;

// eslint-disable-next-line no-console
console.log("[apiClient] API_BASE_URL =", API_BASE_URL);

const logResponseError = async (
  method: string,
  path: string,
  response: Response
): Promise<never> => {
  let responseText: string | undefined;
  let errorDetail: string | undefined;

  try {
    responseText = await response.text();
    // Try to parse as JSON to extract error detail
    try {
      const jsonError = JSON.parse(responseText);
      errorDetail = jsonError.detail || jsonError.message || responseText;
    } catch {
      errorDetail = responseText;
    }
  } catch (parseError) {
    // eslint-disable-next-line no-console
    console.warn(`[apiClient.${method}] Failed to read error body for ${path}`, parseError);
  }

  // eslint-disable-next-line no-console
  console.error(`[apiClient.${method}] Request failed`, {
    path,
    status: response.status,
    statusText: response.statusText,
    body: responseText,
    errorDetail,
  });

  // Create more descriptive error message
  const statusMessages: Record<number, string> = {
    401: "Unauthorized - please log in again",
    403: "Forbidden - you don't have permission",
    404: "Not found - the resource doesn't exist",
    500: "Server error - please try again later",
    502: "Bad gateway - server is temporarily unavailable",
    503: "Service unavailable - please try again later",
  };

  const statusMessage = statusMessages[response.status] || `Request failed with status ${response.status}`;
  const fullMessage = errorDetail ? `${statusMessage}: ${errorDetail}` : statusMessage;

  throw new Error(fullMessage);
};

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
  async get<T>(path: string, options: ApiRequestOptions = {}, isRetry = false): Promise<T> {
    const authHeaders = getAuthHeaders();
    const headers = {
      "Content-Type": "application/json",
      ...authHeaders,
      ...options.headers,
    };

    const fullUrl = `${API_BASE_URL}${path}`;
    // eslint-disable-next-line no-console
    console.log("[apiClient.get]", fullUrl, "- hasAuth:", !!authHeaders.Authorization, "- isRetry:", isRetry);

    try {
      const response = await fetch(fullUrl, {
        credentials: "include", // Send httpOnly cookies automatically
        headers,
      });

      if (!response.ok) {
        // Handle 401 Unauthorized - token expired
        if (response.status === 401 && unauthorizedHandler && !isRetry) {
          // eslint-disable-next-line no-console
          console.log("[apiClient.get] Token expired, attempting reauth and retry");
          await unauthorizedHandler();
          // After reauth, automatically retry the request once
          return apiClient.get<T>(path, options, true);
        }
        return logResponseError("get", path, response);
      }

      return (await response.json()) as T;
    } catch (error) {
      // Network error, CORS error, or other fetch failures
      // eslint-disable-next-line no-console
      console.error("[apiClient.get] Network or fetch error", {
        url: fullUrl,
        error: error instanceof Error ? error.message : String(error),
        errorType: error instanceof TypeError ? "TypeError (network/CORS)" : typeof error,
      });

      if (error instanceof Error) {
        throw new Error(`Network error: ${error.message}`);
      }
      throw new Error("Network error: Failed to connect to server");
    }
  },

  async post<T>(path: string, body: unknown, options: ApiRequestOptions = {}, isRetry = false): Promise<T> {
    const authHeaders = getAuthHeaders();
    const headers = {
      "Content-Type": "application/json",
      ...authHeaders,
      ...options.headers,
    };

    const fullUrl = `${API_BASE_URL}${path}`;
    // eslint-disable-next-line no-console
    console.log("[apiClient.post]", fullUrl, "- hasAuth:", !!authHeaders.Authorization, "- isRetry:", isRetry);

    try {
      const response = await fetch(fullUrl, {
        method: "POST",
        credentials: "include", // Send httpOnly cookies automatically
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        // Handle 401 Unauthorized - token expired
        if (response.status === 401 && unauthorizedHandler && !isRetry) {
          // eslint-disable-next-line no-console
          console.log("[apiClient.post] Token expired, attempting reauth and retry");
          await unauthorizedHandler();
          // After reauth, automatically retry the request once
          return apiClient.post<T>(path, body, options, true);
        }
        return logResponseError("post", path, response);
      }

      return (await response.json()) as T;
    } catch (error) {
      // Network error, CORS error, or other fetch failures
      // eslint-disable-next-line no-console
      console.error("[apiClient.post] Network or fetch error", {
        url: fullUrl,
        error: error instanceof Error ? error.message : String(error),
        errorType: error instanceof TypeError ? "TypeError (network/CORS)" : typeof error,
      });

      if (error instanceof Error) {
        throw new Error(`Network error: ${error.message}`);
      }
      throw new Error("Network error: Failed to connect to server");
    }
  },
};
