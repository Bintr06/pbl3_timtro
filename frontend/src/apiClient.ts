const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';
const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
let refreshInFlight: Promise<boolean> | null = null;

export function setAuthToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function setRefreshToken(token: string) {
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

export function clearAuthToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

async function parseResponse<T>(res: Response): Promise<T> {
  if (res.status === 204) {
    return undefined as T;
  }

  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return (await res.json()) as T;
  }

  const text = await res.text();
  return text as unknown as T;
}

function shouldSkipRefresh(path: string): boolean {
  return [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/google',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    '/api/auth/verify-email',
    '/api/auth/resend-verification',
    '/api/auth/refresh',
    '/api/auth/logout',
  ].some((item) => path.startsWith(item));
}

async function refreshAccessTokenInternal(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    clearAuthToken();
    return false;
  }

  const refreshUrl = API_BASE_URL ? `${API_BASE_URL}/api/auth/refresh` : '/api/auth/refresh';
  const res = await fetch(refreshUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    clearAuthToken();
    return false;
  }

  const body = await parseResponse<{
    data?: {
      token?: string;
      refreshToken?: string;
    };
  }>(res);

  const nextAccessToken = body?.data?.token;
  const nextRefreshToken = body?.data?.refreshToken;

  if (!nextAccessToken || !nextRefreshToken) {
    clearAuthToken();
    return false;
  }

  setAuthToken(nextAccessToken);
  setRefreshToken(nextRefreshToken);
  return true;
}

async function refreshAccessToken(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = refreshAccessTokenInternal().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function request<T>(input: string, init?: RequestInit, canRetry = true): Promise<T> {
  const url = API_BASE_URL
    ? `${API_BASE_URL}${input}`
    : input;

  const token = getAuthToken();
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
    credentials: 'include',
    ...init,
  });

  if (res.status === 401 && canRetry && !shouldSkipRefresh(input)) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return request<T>(input, init, false);
    }
  }

  if (!res.ok) {
    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const errorBody = await res.json();
      const errorMessage = (errorBody && (errorBody.message || errorBody.error || errorBody.errors)) ?? JSON.stringify(errorBody);
      throw new Error(typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage));
    }
    const text = await res.text();
    throw new Error(text || `Request failed with status ${res.status}`);
  }

  return parseResponse<T>(res);
}

export function get<T>(path: string): Promise<T> {
  return request<T>(path);
}

export function post<T, B = unknown>(path: string, body?: B): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function put<T, B = unknown>(path: string, body?: B): Promise<T> {
  return request<T>(path, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function del<T, B = unknown>(path: string, body?: B): Promise<T> {
  return request<T>(path, {
    method: 'DELETE',
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function putFormData<T>(path: string, formData: FormData): Promise<T> {
  const url = API_BASE_URL ? `${API_BASE_URL}${path}` : path;
  const token = getAuthToken();
  let res = await fetch(url, {
    method: 'PUT',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
    body: formData,
  });

  if (res.status === 401 && !shouldSkipRefresh(path)) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      const nextToken = getAuthToken();
      res = await fetch(url, {
        method: 'PUT',
        headers: {
          ...(nextToken ? { Authorization: `Bearer ${nextToken}` } : {}),
        },
        credentials: 'include',
        body: formData,
      });
    }
  }

  if (!res.ok) {
    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const errorBody = await res.json();
      const errorMessage = (errorBody && (errorBody.message || errorBody.error || errorBody.errors)) ?? JSON.stringify(errorBody);
      throw new Error(typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage));
    }
    const text = await res.text();
    throw new Error(text || `Request failed with status ${res.status}`);
  }

  return parseResponse<T>(res);
}

export async function postFormData<T>(path: string, formData: FormData): Promise<T> {
  const url = API_BASE_URL ? `${API_BASE_URL}${path}` : path;
  const token = getAuthToken();
  let res = await fetch(url, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
    body: formData,
  });

  if (res.status === 401 && !shouldSkipRefresh(path)) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      const nextToken = getAuthToken();
      res = await fetch(url, {
        method: 'POST',
        headers: {
          ...(nextToken ? { Authorization: `Bearer ${nextToken}` } : {}),
        },
        credentials: 'include',
        body: formData,
      });
    }
  }

  if (!res.ok) {
    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const errorBody = await res.json();
      const errorMessage = (errorBody && (errorBody.message || errorBody.error || errorBody.errors)) ?? JSON.stringify(errorBody);
      throw new Error(typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage));
    }
    const text = await res.text();
    throw new Error(text || `Request failed with status ${res.status}`);
  }

  return parseResponse<T>(res);
}

