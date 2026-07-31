import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api, TOKEN_KEY, clearStoredSession } from '@/utils/http';

export interface UserInfo {
  id: string;
  username: string;
  displayName: string;
  role: string;
}

interface AuthResponse {
  accessToken: string;
  user: UserInfo;
}

const USER_KEY = 'aureka_user';

function readStoredUser(): UserInfo | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as UserInfo) : null;
  } catch {
    return null;
  }
}

export const useUserStore = defineStore('user', () => {
  const user = ref<UserInfo | null>(readStoredUser());
  const token = ref<string | null>(localStorage.getItem(TOKEN_KEY));

  const isAuthenticated = computed(() => !!token.value);
  const displayName = computed(() => user.value?.displayName ?? user.value?.username ?? '');

  function applySession(res: AuthResponse) {
    token.value = res.accessToken;
    user.value = res.user;
    localStorage.setItem(TOKEN_KEY, res.accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
  }

  /** Username/password login proxied through the backend to JitWord. */
  async function login(username: string, password: string) {
    const res = await api<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: { username, password },
    });
    applySession(res);
    return res.user;
  }

  /** Auto-login: exchange an existing JitWord token for a session. */
  async function ssoLogin(jwt: string) {
    const res = await api<AuthResponse>('/api/auth/sso', {
      method: 'POST',
      body: { token: jwt },
    });
    applySession(res);
    return res.user;
  }

  function logout() {
    user.value = null;
    token.value = null;
    clearStoredSession();
  }

  return {
    user,
    token,
    isAuthenticated,
    displayName,
    login,
    ssoLogin,
    logout,
  };
});
