const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';
const TOKEN_KEY = 'auth_token';

export function setAuthToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY);
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

async function request<T>(input: string, init?: RequestInit): Promise<T> {
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

export function del<T>(path: string): Promise<T> {
  return request<T>(path, {
    method: 'DELETE',
  });
}

export async function putFormData<T>(path: string, formData: FormData): Promise<T> {
  const url = API_BASE_URL ? `${API_BASE_URL}${path}` : path;
  const token = getAuthToken();
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
    body: formData,
  });

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
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
    body: formData,
  });

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

