import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface Toast {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  duration?: number;
}

export type Theme = 'dark' | 'light';

const THEME_STORAGE_KEY = 'aureka_theme';

/** Resolve the initial theme: stored preference first, then OS preference. */
function getInitialTheme(): Theme {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

/** Reflect the theme onto <html> so the CSS variable overrides kick in. */
function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

export const useUIStore = defineStore('ui', () => {
  const sidebarCollapsed = ref(false);
  const chatPanelCollapsed = ref(false);
  const activeModal = ref<string | null>(null);
  const toasts = ref<Toast[]>([]);
  const theme = ref<Theme>(getInitialTheme());

  // Apply the resolved theme as early as the store is created.
  applyTheme(theme.value);

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value;
  }

  function toggleChatPanel() {
    chatPanelCollapsed.value = !chatPanelCollapsed.value;
  }

  function setTheme(next: Theme) {
    theme.value = next;
    applyTheme(next);
    localStorage.setItem(THEME_STORAGE_KEY, next);
  }

  function toggleTheme() {
    setTheme(theme.value === 'dark' ? 'light' : 'dark');
  }

  function openModal(modalId: string) {
    activeModal.value = modalId;
  }

  function closeModal() {
    activeModal.value = null;
  }

  function addToast(toast: Omit<Toast, 'id'>) {
    const id = Math.random().toString(36).slice(2, 10);
    toasts.value.push({ ...toast, id });

    const duration = toast.duration ?? 3000;
    setTimeout(() => {
      removeToast(id);
    }, duration);
  }

  function removeToast(id: string) {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }

  return {
    sidebarCollapsed,
    chatPanelCollapsed,
    activeModal,
    toasts,
    theme,
    toggleSidebar,
    toggleChatPanel,
    setTheme,
    toggleTheme,
    openModal,
    closeModal,
    addToast,
    removeToast,
  };
});
