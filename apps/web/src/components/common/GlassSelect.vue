<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { ChevronDown, Check } from 'lucide-vue-next';

export interface SelectOption {
  value: string;
  label: string;
  hint?: string;
}

const props = defineProps<{
  modelValue: string;
  options: SelectOption[];
  placeholder?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const open = ref(false);
const rootRef = ref<HTMLElement | null>(null);

const selected = computed(() => props.options.find((o) => o.value === props.modelValue));

function toggle() {
  open.value = !open.value;
}

function select(value: string) {
  emit('update:modelValue', value);
  open.value = false;
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') open.value = false;
}

function onClickOutside(e: MouseEvent) {
  if (rootRef.value && !rootRef.value.contains(e.target as Node)) {
    open.value = false;
  }
}

onMounted(() => document.addEventListener('mousedown', onClickOutside));
onBeforeUnmount(() => document.removeEventListener('mousedown', onClickOutside));
</script>

<template>
  <div ref="rootRef" class="gselect" :class="{ 'gselect--open': open }" @keydown="onKeydown">
    <button type="button" class="gselect__trigger glass-input" @click="toggle">
      <span class="gselect__value" :class="{ 'gselect__value--placeholder': !selected }">
        {{ selected ? selected.label : placeholder || '' }}
      </span>
      <ChevronDown :size="16" class="gselect__chevron" />
    </button>

    <transition name="gselect">
      <div v-if="open" class="gselect__menu">
        <button
          v-for="opt in options"
          :key="opt.value"
          type="button"
          class="gselect__option"
          :class="{ 'gselect__option--active': opt.value === modelValue }"
          @click="select(opt.value)"
        >
          <span class="gselect__option-label">{{ opt.label }}</span>
          <span v-if="opt.hint" class="gselect__option-hint">{{ opt.hint }}</span>
          <Check v-if="opt.value === modelValue" :size="14" class="gselect__check" />
        </button>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.gselect {
  position: relative;
  width: 100%;
}

.gselect__trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-sm);
  color: var(--color-text-primary);
  cursor: pointer;
  text-align: left;
}

.gselect__value--placeholder {
  color: var(--color-text-muted);
}

.gselect__chevron {
  color: var(--color-text-secondary);
  transition: transform var(--duration-fast) var(--ease-out);
  flex-shrink: 0;
}

.gselect--open .gselect__chevron {
  transform: rotate(180deg);
}

.gselect__menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 100;
  padding: var(--space-1);
  max-height: 280px;
  overflow-y: auto;
  background: var(--glass-modal-bg);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid var(--ov-10);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-pop);
}

.gselect__option {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
  color: var(--color-text-primary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-out);
  text-align: left;
}

.gselect__option:hover {
  background: var(--ov-06);
}

.gselect__option--active {
  background: var(--ov-08);
}

.gselect__option-label {
  flex: 1;
}

.gselect__option-hint {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.gselect__check {
  color: var(--color-text-primary);
  flex-shrink: 0;
}

.gselect-enter-active,
.gselect-leave-active {
  transition:
    opacity var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}

.gselect-enter-from,
.gselect-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
