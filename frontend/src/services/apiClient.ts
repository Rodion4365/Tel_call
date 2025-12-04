export interface ApiRequestOptions {
  headers?: Record<string, string>;
}

// URL бэкенда по умолчанию — твой Render
const DEFAULT_API_BASE_URL = "https://tel-call-backend.onrender.com";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;

// eslint-disable-next-line no-console
console.log("[apiClient] API_BASE_URL =", API_BASE_URL);

export const apiClient = {
  async get<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      credentials: "include", // Send httpOnly cookies automatically
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    return (await response.json()) as T;
  },

  async post<T>(path: string, body: unknown, options: ApiRequestOptions = {}): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      credentials: "include", // Send httpOnly cookies automatically
      headers: {
        "Content-Type": "application/json",
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
