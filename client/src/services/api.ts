const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

function getAuthToken(): string | null {
  return localStorage.getItem('fluentlens_token');
}

export function setAuthToken(token: string) {
  localStorage.setItem('fluentlens_token', token);
}

export function removeAuthToken() {
  localStorage.removeItem('fluentlens_token');
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // If not FormData, set Content-Type to application/json
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }

  return data as T;
}

export const api = {
  auth: {
    register: (payload: { email: string; password: string; name: string; timezone: string }) =>
      request<{ token: string; user: any }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    login: (payload: { email: string; password: string }) =>
      request<{ token: string; user: any }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    me: () => request<{ user: any }>('/api/auth/me'),
  },
  sessions: {
    create: (formData: FormData) =>
      request<{ id: string; status: string; mediaType: string; durationSec: number }>('/api/sessions', {
        method: 'POST',
        body: formData,
      }),
    get: (id: string) => request<any>(`/api/sessions/${id}`),
    list: () => request<any[]>('/api/sessions'),
    ask: (id: string, question: string) =>
      request<{ answer: string; isFallback: boolean; chat: any[] }>(`/api/sessions/${id}/ask`, {
        method: 'POST',
        body: JSON.stringify({ question }),
      }),
    reevaluate: (id: string, temperature: number) =>
      request<{ id: string; status: string }>(`/api/sessions/${id}/reevaluate`, {
        method: 'POST',
        body: JSON.stringify({ temperature }),
      }),
  },
  vocab: {
    save: (payload: { word: string; meaning: string; example: string; language: string; sourceSessionId?: string }) =>
      request<any>('/api/vocab', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    list: (status?: 'saved' | 'learned') =>
      request<any[]>(`/api/vocab${status ? `?status=${status}` : ''}`),
    delete: (id: string) =>
      request<{ message: string }>(`/api/vocab/${id}`, {
        method: 'DELETE',
      }),
  },
  progress: {
    get: () => request<any>('/api/progress'),
  },
};
