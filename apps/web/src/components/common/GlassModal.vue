<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { X } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = defineProps<{
  open: boolean;
  title: string;
  /** Confirm button label; falls back to common.confirm. */
  confirmText?: string;
  /** Disable the confirm button (e.g. invalid input). */
  confirmDisabled?: boolean;
}>();

const emit = defineEmits<{
  (e: 'confirm'): void;
  (e: 'close'): void;
}>();

const panel = ref<HTMLElement | null>(null);

watch(() => props.open, async (open) => {
  if (open) {
    await nextTick();
    // Focus the first input inside the modal for immediate typing
    panel.value?.querySelector<HTMLInputElement>('input, textarea, select')?.focus();
  }
});

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close');
  if (e.key === 'Enter' && !props.confirmDisabled) emit('confirm');
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="open" class="modal glass-modal-overlay" @mousedown.self="emit('close')" @keydown="onKeydown">
        <div ref="panel" class="modal__panel glass-modal" role="dialog" :aria-label="title">
          <div class="modal__header">
            <h3 class="modal__title">{{ title }}</h3>
            <button class="modal__close" :aria-label="t('common.cancel')" @click="emit('close')">
              <X :size="16" />
            </button>
          </div>

          <div class="modal__body">
            <slot />
          </div>

          <div class="modal__footer">
            <button class="modal__btn" @click="emit('close')">{{ t('common.cancel') }}</button>
            <button class="modal__btn modal__btn--primary" :disabled="confirmDisabled" @click="emit('confirm')">
              {{ confirmText || t('common.confirm') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-6);
}

.modal__panel {
  width: 100%;
  max-width: 420px;
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal__title {
  font-size: var(--text-base);
  font-weight: 600;
  letter-spacing: -0.01em;
}

.modal__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  transition: all var(--duration-fast) var(--ease-out);
}

.modal__close:hover {
  color: var(--color-text-primary);
  background: var(--ov-06);
}

.modal__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}

.modal__btn {
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
  transition: all var(--duration-fast) var(--ease-out);
}

.modal__btn:hover {
  color: var(--color-text-primary);
  border-color: var(--color-border-hover);
}

.modal__btn--primary {
  color: var(--color-bg-primary);
  background: var(--color-text-primary);
  border-color: var(--color-text-primary);
  font-weight: 600;
}

.modal__btn--primary:hover:not(:disabled) {
  opacity: 0.9;
}

.modal__btn--primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity var(--duration-fast) var(--ease-out);
}

.modal-fade-enter-active .modal__panel,
.modal-fade-leave-active .modal__panel {
  transition: transform var(--duration-fast) var(--ease-out);
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-from .modal__panel,
.modal-fade-leave-to .modal__panel {
  transform: scale(0.96) translateY(8px);
}
</style>
