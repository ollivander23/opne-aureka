<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router';
import { useUIStore } from '@/stores/ui';
import { computed, onMounted, onUnmounted, ref } from 'vue';
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
  Headset,
  X,
} from 'lucide-vue-next';

const { t, locale } = useI18n();
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

/** Contact-author modal with the WeChat QR code. */
const contactOpen = ref(false);

/** QR image depends on the active locale: local asset for English,
 * remote image for Chinese. */
const qrSrc = computed(() =>
  locale.value === 'zh-CN'
    ? 'https://next.jitword.com/uploads/WechatIMG246_19d428a664c.jpg'
    : `${import.meta.env.BASE_URL}alexs_xu.png`,
);

function openContact() {
  contactOpen.value = true;
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') contactOpen.value = false;
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));
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

    <!-- Contact author — pinned to the bottom of the sidebar -->
    <div class="sidebar__footer">
      <button
        class="sidebar__contact"
        :title="t('nav.contactAuthor')"
        @click="openContact"
      >
        <Headset :size="18" />
        <span v-if="!collapsed" class="sidebar__contact-label">{{ t('nav.contactAuthor') }}</span>
      </button>
    </div>

    <!-- QR code modal -->
    <Teleport to="body">
      <Transition name="contact-fade">
        <div v-if="contactOpen" class="contact-overlay" @mousedown.self="contactOpen = false">
          <div class="contact-panel" role="dialog" :aria-label="t('nav.contactAuthor')">
            <button class="contact-panel__close" :title="t('common.cancel')" @click="contactOpen = false">
              <X :size="16" />
            </button>
            <h3 class="contact-panel__title">{{ t('nav.contactAuthor') }}</h3>
            <img
              class="contact-panel__qr"
              :src="qrSrc"
              :alt="t('nav.contactAuthor')"
            />
            <p class="contact-panel__desc">{{ t('nav.contactAuthorDesc') }}</p>
          </div>
        </div>
      </Transition>
    </Teleport>
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

.sidebar__footer {
  margin-top: auto;
  padding-top: var(--space-3);
}

/* Black, high-contrast contact button pinned at the sidebar bottom. */
.sidebar__contact {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: #000000;
  color: #ffffff;
  font-size: var(--text-sm);
  font-weight: 600;
  letter-spacing: 0.02em;
  white-space: nowrap;
  overflow: hidden;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  transition: all var(--duration-fast) var(--ease-out);
}

.sidebar__contact:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  background: #1a1a1a;
}

.sidebar__contact:active {
  transform: translateY(0);
}

.sidebar--collapsed .sidebar__contact {
  padding: var(--space-3) 0;
}

.sidebar__contact-label {
  overflow: hidden;
  text-overflow: ellipsis;
}

/* QR code modal */
.contact-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-6);
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(6px);
}

.contact-panel {
  position: relative;
  width: 100%;
  max-width: 320px;
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  background: var(--color-surface-solid, var(--color-bg-primary));
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
}

.contact-panel__close {
  position: absolute;
  top: var(--space-3);
  right: var(--space-3);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  transition: all var(--duration-fast) var(--ease-out);
}

.contact-panel__close:hover {
  color: var(--color-text-primary);
  background: var(--color-accent);
}

.contact-panel__title {
  font-size: var(--text-base);
  font-weight: 600;
  letter-spacing: -0.01em;
}

.contact-panel__qr {
  width: 200px;
  height: 200px;
  object-fit: contain;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: #ffffff;
}

.contact-panel__desc {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  text-align: center;
}

.contact-fade-enter-active,
.contact-fade-leave-active {
  transition: opacity var(--duration-fast) var(--ease-out);
}

.contact-fade-enter-active .contact-panel,
.contact-fade-leave-active .contact-panel {
  transition: transform var(--duration-fast) var(--ease-out);
}

.contact-fade-enter-from,
.contact-fade-leave-to {
  opacity: 0;
}

.contact-fade-enter-from .contact-panel,
.contact-fade-leave-to .contact-panel {
  transform: scale(0.96) translateY(8px);
}
</style>
