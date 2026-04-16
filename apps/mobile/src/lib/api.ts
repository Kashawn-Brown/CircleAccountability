// src/lib/api.ts
// Typed HTTP client for the Circle Accountability API — mobile version.
// Pattern mirrors apps/web/src/lib/api.ts intentionally.

import type { ApiError, ApiResponse } from '@circle/types';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!res.ok) {
      const err: ApiError = await res.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(err.error ?? `HTTP ${res.status}`);
    }

    if (res.status === 204) return undefined as T;

    const body: ApiResponse<T> = await res.json();
    return body.data;
  }

  get<T>(path: string, init?: RequestInit) {
    return this.request<T>(path, { ...init, method: 'GET' });
  }

  post<T>(path: string, body: unknown, init?: RequestInit) {
    return this.request<T>(path, { ...init, method: 'POST', body: JSON.stringify(body) });
  }

  patch<T>(path: string, body: unknown, init?: RequestInit) {
    return this.request<T>(path, { ...init, method: 'PATCH', body: JSON.stringify(body) });
  }

  delete<T>(path: string, init?: RequestInit) {
    return this.request<T>(path, { ...init, method: 'DELETE' });
  }
}

export const api = new ApiClient(API_URL);
