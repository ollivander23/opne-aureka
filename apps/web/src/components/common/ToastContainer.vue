<script setup lang="ts">
import { useUIStore } from '@/stores/ui';
import { Info, CheckCircle2, AlertTriangle, XCircle, X } from 'lucide-vue-next';
import type { Toast } from '@/stores/ui';

const uiStore = useUIStore();

const iconMap = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
} as const;

function iconFor(type: Toast['type']) {
  return iconMap[type];
}
</script>

<template>
  <div class="toast-container">
    <transition-group name="toast">
      <div
        v-for="toast in uiStore.toasts"
        :key="toast.id"
        class="toast glass-panel"
        :class="`toast--${toast.type}`"
        role="status"
      >
        <component :is="iconFor(toast.type)" :size="16" class="toast__icon" />
        <span class="toast__message">{{ toast.message }}</span>
        <button class="toast__close" @click="uiStore.removeToast(toast.id)">
          <X :size="14" />
        </button>
      </div>
    </transition-group>
  </div>
</template>

<style scoped>
.toast-container {
  position: fixed;
  top: var(--space-6);
  right: var(--space-6);
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  max-width: 360px;
}

.toast {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-sm);
  color: var(--color-text-primary);
  box-shadow: var(--shadow-glass);
}

.toast__icon {
  flex-shrink: 0;
}

.toast--info .toast__icon {
  color: var(--color-text-secondary);
}

.toast--success .toast__icon {
  color: var(--status-success);
}

.toast--warning .toast__icon {
  color: var(--status-warning);
}

.toast--error .toast__icon {
  color: var(--status-error);
}

.toast__message {
  flex: 1;
  line-height: 1.4;
}

.toast__close {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  cursor: pointer;
  flex-shrink: 0;
  transition: color var(--duration-fast) var(--ease-out);
}

.toast__close:hover {
  color: var(--color-text-primary);
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity var(--duration-normal) var(--ease-out),
    transform var(--duration-normal) var(--ease-out);
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(16px);
}
</style>
