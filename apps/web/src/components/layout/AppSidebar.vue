<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router';
import { useUIStore } from '@/stores/ui';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Home,
  Database,
  MessageSquare,
  FileText,
  LayoutDashboard,
  PenSquare,
  BookOpen,
  Table2,
  ExternalLink,
} from 'lucide-vue-next';

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const uiStore = useUIStore();

const navItems = computed(() => [
  { path: '/', label: t('nav.home'), icon: Home },
  { path: '/datasets', label: t('nav.datasets'), icon: Database },
  { path: '/history', label: t('nav.history'), icon: MessageSquare },
  { path: '/reports', label: t('nav.reports'), icon: FileText },
  { path: '/workspace', label: t('nav.workspace'), icon: LayoutDashboard },
]);

/** External product links shown under the "Ecosystem" section. */
const ecoItems = computed(() => [
  { url: 'https://github.com/jitOffice/jitword-sdk', label: t('nav.ecoJitword'), icon: PenSquare },
  { url: 'https://know.jitword.com', label: t('nav.ecoKnowledge'), icon: BookOpen },
  { url: 'https://pxcharts.turntip.cn', label: t('nav.ecoPxcharts'), icon: Table2 },
]);

const isActive = (path: string) => {
  if (path === '/') return route.path === '/';
  return route.path.startsWith(path);
};

const collapsed = computed(() => uiStore.sidebarCollapsed);
</script>

<template>
  <aside class="sidebar glass-sidebar" :class="{ 'sidebar--collapsed': collapsed }">
    <nav class="sidebar__nav">
      <button
        v-for="item in navItems"
        :key="item.path"
        class="sidebar__item"
        :class="{ 'sidebar__item--active': isActive(item.path) }"
        :title="collapsed ? item.label : undefined"
        @click="router.push(item.path)"
      >
        <component :is="item.icon" :size="20" />
        <span v-if="!collapsed" class="sidebar__label">{{ item.label }}</span>
      </button>
    </nav>

    <!-- Ecosystem: external product links -->
    <div class="sidebar__section">
      <div class="sidebar__divider" />
      <div v-if="!collapsed" class="sidebar__section-title">{{ t('nav.ecosystem') }}</div>
      <nav class="sidebar__nav">
        <a
          v-for="item in ecoItems"
          :key="item.url"
          class="sidebar__item sidebar__item--external"
          :href="item.url"
          target="_blank"
          rel="noopener noreferrer"
          :title="collapsed ? item.label : undefined"
        >
          <component :is="item.icon" :size="20" />
          <span v-if="!collapsed" class="sidebar__label">{{ item.label }}</span>
          <ExternalLink v-if="!collapsed" :size="12" class="sidebar__external-icon" />
        </a>
      </nav>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  position: fixed;
  top: var(--header-height);
  left: 0;
  bottom: 0;
  width: var(--sidebar-width);
  display: flex;
  flex-direction: column;
  padding: var(--space-3);
  z-index: 90;
  transition: width var(--duration-normal) var(--ease-out);
}

.sidebar--collapsed {
  width: var(--sidebar-collapsed-width);
}

.sidebar__nav {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.sidebar__item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
  font-weight: 500;
  transition: all var(--duration-fast) var(--ease-out);
  white-space: nowrap;
  overflow: hidden;
}

.sidebar__item:hover {
  color: var(--color-text-primary);
  background: var(--color-accent);
}

.sidebar__item--active {
  color: var(--color-text-primary);
  background: var(--ov-08);
}

.sidebar--collapsed .sidebar__item {
  justify-content: center;
  padding: var(--space-3);
}

.sidebar__label {
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar__section {
  margin-top: var(--space-3);
}

.sidebar__divider {
  height: 1px;
  background: var(--color-border);
  margin: 0 var(--space-2) var(--space-3);
}

.sidebar__section-title {
  padding: 0 var(--space-3);
  margin-bottom: var(--space-1);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
}

.sidebar__item--external .sidebar__label {
  flex: 1;
}

.sidebar__external-icon {
  flex-shrink: 0;
  color: var(--color-text-muted);
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.sidebar__item--external:hover .sidebar__external-icon {
  opacity: 1;
}
</style>
