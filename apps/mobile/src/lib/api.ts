// src/lib/api.ts
// Typed HTTP client for the Circle Accountability API — mobile version.
// Pattern mirrors apps/web/src/lib/api.ts intentionally.
//
// Auth: setTokenGetter is called once at app init from a component that
// has access to Clerk's useAuth() hook (see app/_layout.tsx). Every
// request pulls a fresh token from that getter and attaches it as
// Authorization: Bearer <jwt>. We don't cache the token — Clerk session
// tokens are short-lived and refresh in the background, so a cached
// copy would go stale within the hour.

import type { ApiError, ApiResponse } from '@circle/types';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8090';

type TokenGetter = () => Promise<string | null>;

class ApiClient {
  private baseUrl: string;
  private getToken: TokenGetter = async () => null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  // Bind the client to a source of Clerk session tokens. Called once from
  // the root layout's RootContent component.
  setTokenGetter(fn: TokenGetter) {
    this.getToken = fn;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) ?? {}),
    };

    const token = await this.getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(url, { ...options, headers });

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
