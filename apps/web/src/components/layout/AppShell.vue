<script setup lang="ts">
import AppHeader from './AppHeader.vue';
import AppSidebar from './AppSidebar.vue';
import { useUIStore } from '@/stores/ui';
import { computed } from 'vue';

const uiStore = useUIStore();
const sidebarWidth = computed(() =>
  uiStore.sidebarCollapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)'
);
</script>

<template>
  <div class="app-shell">
    <AppHeader />
    <div class="app-shell__body">
      <AppSidebar />
      <main class="app-shell__main" :style="{ marginLeft: sidebarWidth }">
        <slot />
      </main>
    </div>
  </div>
</template>

<style scoped>
.app-shell {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.app-shell__body {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.app-shell__main {
  height: 100%;
  overflow-y: auto;
  transition: margin-left var(--duration-normal) var(--ease-out);
}
</style>
