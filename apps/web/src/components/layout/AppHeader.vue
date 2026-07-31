<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useUIStore } from '@/stores/ui';
import { useUserStore } from '@/stores/user';
import { PanelLeftClose, PanelLeftOpen, Settings, Languages, Sun, Moon, Github, BookOpen, LogOut } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import { setLocale, getLocale } from '@/locales';
import type { LocaleKey } from '@/locales';

const router = useRouter();
const uiStore = useUIStore();
const userStore = useUserStore();
const { locale, t } = useI18n();

function toggleLocale() {
  const next: LocaleKey = getLocale() === 'zh-CN' ? 'en-US' : 'zh-CN';
  setLocale(next);
}

function handleLogout() {
  userStore.logout();
  router.push('/login');
}
</script>

<template>
  <header class="app-header glass-header">
    <div class="app-header__left">
      <button class="app-header__toggle" @click="uiStore.toggleSidebar">
        <PanelLeftClose v-if="!uiStore.sidebarCollapsed" :size="18" />
        <PanelLeftOpen v-else :size="18" />
      </button>
      <div class="app-header__brand" @click="router.push('/')">
        <span class="app-header__logo">{{ locale === 'zh-CN' ? '灵' : 'A' }}</span>
        <span class="app-header__title">{{ t('brand.name') }}</span>
      </div>
    </div>

    <div class="app-header__right">
      <a
        class="app-header__book"
        href="https://aibook.mvtable.com/"
        target="_blank"
        rel="noopener noreferrer"
      >
        <BookOpen :size="14" />
        <span>{{ t('nav.aiBook') }}</span>
      </a>
      <a
        class="app-header__action"
        href="https://github.com/MrXujiang/aureka"
        target="_blank"
        rel="noopener noreferrer"
        :title="t('nav.github')"
      >
        <Github :size="17" />
      </a>
      <button
        class="app-header__action"
        :title="uiStore.theme === 'dark' ? t('theme.switchToLight') : t('theme.switchToDark')"
        @click="uiStore.toggleTheme"
      >
        <Sun v-if="uiStore.theme === 'dark'" :size="17" />
        <Moon v-else :size="17" />
      </button>
      <button
        class="app-header__action app-header__locale"
        :title="locale === 'zh-CN' ? 'Switch to English' : '切换到中文'"
        @click="toggleLocale"
      >
        <Languages :size="16" />
        <span class="app-header__locale-label">{{ locale === 'zh-CN' ? 'EN' : '中' }}</span>
      </button>
      <button class="app-header__action" @click="router.push('/settings')">
        <Settings :size="18" />
      </button>
      <template v-if="userStore.isAuthenticated">
        <span class="app-header__user" :title="userStore.user?.username">
          <span class="app-header__avatar">{{ (userStore.displayName || '?').charAt(0).toUpperCase() }}</span>
          <span class="app-header__user-name">{{ userStore.displayName }}</span>
        </span>
        <button class="app-header__action" :title="t('login.logout')" @click="handleLogout">
          <LogOut :size="17" />
        </button>
      </template>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  height: var(--header-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-4);
  position: relative;
  z-index: 100;
}

.app-header__left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.app-header__toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  transition: all var(--duration-fast) var(--ease-out);
}

.app-header__toggle:hover {
  color: var(--color-text-primary);
  background: var(--color-accent);
}

.app-header__brand {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
}

.app-header__logo {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-text-primary);
  color: var(--color-bg-primary);
  border-radius: var(--radius-sm);
  font-weight: 700;
  font-size: var(--text-sm);
}

.app-header__title {
  font-size: var(--text-base);
  font-weight: 600;
  letter-spacing: -0.02em;
}

.app-header__right {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.app-header__action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  transition: all var(--duration-fast) var(--ease-out);
}

.app-header__action:hover {
  color: var(--color-text-primary);
  background: var(--color-accent);
}

.app-header__locale {
  gap: var(--space-1);
  width: auto;
  padding: 0 var(--space-2);
}

.app-header__locale-label {
  font-size: 11px;
  font-weight: 600;
}

/* AI learning manual entry — deliberately vivid so it stands out from the
   quiet icon actions around it. Inverted black/white keeps it prominent while
   staying on-brand with the monochrome, tech look. */
.app-header__book {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  height: 30px;
  padding: 0 var(--space-3);
  border-radius: var(--radius-full, 999px);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  white-space: nowrap;
  /* Inverts with the theme: white-on-black in dark mode, black-on-white in light. */
  color: var(--color-bg-primary);
  background: var(--color-text-primary);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
  transition: all var(--duration-fast) var(--ease-out);
}

.app-header__book:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
  opacity: 0.9;
}

.app-header__book:active {
  transform: translateY(0);
}

.app-header__user {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  height: 30px;
  padding: 0 var(--space-2) 0 var(--space-1);
  border-radius: var(--radius-full, 999px);
  border: 1px solid var(--color-border);
  background: var(--glass-bg);
  max-width: 160px;
}

.app-header__avatar {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--color-text-primary);
  color: var(--color-bg-primary);
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}

.app-header__user-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
