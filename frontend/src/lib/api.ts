import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';

let accessToken: string | null = null;
let tenantId: string | null = null;

export const session = {
  setAccessToken(token: string | null) {
    accessToken = token;
  },
  setTenantId(id: string | null) {
    tenantId = id;
  },
  getTenantId() {
    return tenantId;
  },
  hasAccess() {
    return accessToken !== null;
  },
};

/** Cliente HTTP. Las cookies de refresh viajan con `withCredentials`. */
export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 20_000,
});

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  if (tenantId) config.headers['X-Tenant-ID'] = tenantId;
  return config;
});

let refreshing: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (!refreshing) {
    refreshing = api
      .post<{ access: string }>('/auth/refresh/')
      .then((response) => {
        session.setAccessToken(response.data.access);
        return response.data.access;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const isAuthCall = original?.url?.includes('/auth/') ?? false;
    if (error.response?.status === 401 && original && !original._retry && !isAuthCall) {
      original._retry = true;
      try {
        const token = await refreshAccessToken();
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      } catch {
        session.setAccessToken(null);
        window.dispatchEvent(new Event('session-expired'));
      }
    }
    return Promise.reject(error);
  },
);

/** Mensaje legible a partir del formato estándar de error de la API. */
export function errorMessage(error: unknown, fallback = 'Ocurrió un error. Intentá de nuevo.'): string {
  const data = (error as AxiosError<{ error?: { message?: string; details?: Record<string, string[]> } }>)
    ?.response?.data;
  const details = data?.error?.details;
  if (details && typeof details === 'object') {
    const first = Object.values(details).flat()[0];
    if (typeof first === 'string') return first;
  }
  return data?.error?.message ?? fallback;
}
