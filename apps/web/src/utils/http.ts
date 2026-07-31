import { ofetch } from 'ofetch';

/**
 * Central API client.
 *
 * Every request automatically carries the JitWord-issued JWT so the backend
 * can identify the caller. Reading the token from localStorage (instead of
 * importing the Pinia store) avoids a circular dependency and guarantees the
 * freshest value on every call.
 *
 * A 401 means the token is missing/invalid/expired: we clear the local
 * session and send the user back to the login page.
 */
export const TOKEN_KEY = 'aureka_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearStoredSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('aureka_user');
}

export const api = ofetch.create({
  onRequest({ options }) {
    const token = getStoredToken();
    if (token) {
      const headers = new Headers(options.headers as HeadersInit | undefined);
      headers.set('Authorization', `Bearer ${token}`);
      options.headers = headers;
    }
  },
  onResponseError({ response }) {
    if (response.status === 401) {
      clearStoredSession();
      // Full reload so all in-memory auth state is dropped cleanly.
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
      }
    }
  },
});
