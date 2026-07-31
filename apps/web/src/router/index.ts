import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';
import { useUserStore } from '@/stores/user';

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { title: 'Login', public: true },
  },
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomeView.vue'),
    meta: { title: 'Aureka' },
  },
  {
    path: '/workspace/:datasetId?',
    name: 'workspace',
    component: () => import('@/views/WorkspaceView.vue'),
    meta: { title: 'Analysis Workspace' },
  },
  {
    path: '/datasets',
    name: 'datasets',
    component: () => import('@/views/DatasetView.vue'),
    meta: { title: 'Data Management' },
  },
  {
    path: '/history',
    name: 'history',
    component: () => import('@/views/HistoryView.vue'),
    meta: { title: 'Conversation History' },
  },
  {
    path: '/reports',
    name: 'reports',
    component: () => import('@/views/ReportView.vue'),
    meta: { title: 'Report Center' },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/SettingsView.vue'),
    meta: { title: 'Settings' },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

/**
 * JitWord writes its JWT to `localStorage.jwt_token` and hands it over via a
 * `?token=` URL parameter (see JitWord OpenAPI "鉴权说明"). We reuse either
 * source to sign the user in silently — this is the auto-login / SSO path.
 */
const JITWORD_TOKEN_KEY = 'jwt_token';

function pickSsoToken(): string | null {
  // 1) URL handoff: /?token=<jwt>. The guard strips the param afterwards so
  //    the token never lingers in the address bar (Vue Router owns the URL).
  const url = new URL(window.location.href);
  const fromUrl = url.searchParams.get('token');
  if (fromUrl) return fromUrl;
  // 2) Same-domain login state shared with JitWord.
  return localStorage.getItem(JITWORD_TOKEN_KEY);
}

/** Runs once: adopt a JitWord token if we don't already have a session. */
let autoLoginPromise: Promise<void> | null = null;
function bootstrapAutoLogin(): Promise<void> {
  if (!autoLoginPromise) {
    autoLoginPromise = (async () => {
      const userStore = useUserStore();
      if (userStore.isAuthenticated) return;
      const ssoToken = pickSsoToken();
      if (!ssoToken) return;
      try {
        await userStore.ssoLogin(ssoToken);
      } catch {
        // Invalid/expired token — fall through to the login page.
      }
    })();
  }
  return autoLoginPromise;
}

router.beforeEach(async (to, _from, next) => {
  const title = to.meta.title as string;
  document.title = title ? `${title} - Aureka` : 'Aureka';

  await bootstrapAutoLogin();
  const userStore = useUserStore();

  // Strip the ?token= SSO handoff param so it never lingers in the address bar.
  if (to.query.token) {
    const { token: _token, ...rest } = to.query;
    return next({ path: to.path, query: rest, replace: true });
  }

  if (to.meta.public) {
    // Already signed in? Skip the login page.
    if (userStore.isAuthenticated && to.name === 'login') {
      return next('/');
    }
    return next();
  }

  if (!userStore.isAuthenticated) {
    return next({ path: '/login', query: { redirect: to.fullPath } });
  }

  next();
});

export default router;
