export interface ApiRequestOptions {
  token?: string;
  headers?: Record<string, string>;
}

const AUTH_STORAGE_KEY = "telegram-auth-v2";

const resolveToken = (explicitToken?: string): string | null => {
  if (explicitToken) {
    return explicitToken;
  }

  const stored = localStorage.getItem(AUTH_STORAGE_KEY);

  if (!stored) {
    return null;
  }

  try {
    const parsed = JSON.parse(stored) as { token?: string };
    return parsed.token ?? null;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn("[apiClient] Failed to parse stored auth token", error);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
};

// URL бэкенда по умолчанию — твой Render
const DEFAULT_API_BASE_URL = "https://tel-call-backend.onrender.com";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;

// eslint-disable-next-line no-console
console.log("[apiClient] API_BASE_URL =", API_BASE_URL);

export const apiClient = {
  async get<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    const token = resolveToken(options.token);
    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    return (await response.json()) as T;
  },

  async post<T>(path: string, body: unknown, options: ApiRequestOptions = {}): Promise<T> {
    const token = resolveToken(options.token);
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    return (await response.json()) as T;
  },
};
