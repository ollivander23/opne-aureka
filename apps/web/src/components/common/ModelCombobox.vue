<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { ChevronDown, Check } from 'lucide-vue-next';

const props = defineProps<{
  modelValue: string;
  suggestions: string[];
  placeholder?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const open = ref(false);
const focused = ref(false);
const rootRef = ref<HTMLElement | null>(null);

/**
 * Filter suggestions by the current input (case-insensitive).
 * Show the full list when the input is empty or exactly matches a
 * suggestion (browsing mode); otherwise narrow down by substring.
 */
const filtered = computed(() => {
  const q = props.modelValue.trim().toLowerCase();
  if (!q || props.suggestions.some((s) => s.toLowerCase() === q)) {
    return props.suggestions;
  }
  return props.suggestions.filter((s) => s.toLowerCase().includes(q));
});

/** Show panel when focused and there are candidates. */
const showPanel = computed(() => open.value && filtered.value.length > 0);

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value);
  open.value = true;
}

function onFocus() {
  focused.value = true;
  open.value = true;
}

function onBlur() {
  focused.value = false;
}

function pick(model: string) {
  emit('update:modelValue', model);
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
  <div ref="rootRef" class="mcombo" @keydown="onKeydown">
    <div class="mcombo__field glass-input" :class="{ 'mcombo__field--focus': focused }">
      <input
        class="mcombo__input"
        type="text"
        :value="modelValue"
        :placeholder="placeholder"
        spellcheck="false"
        autocomplete="off"
        @input="onInput"
        @focus="onFocus"
        @blur="onBlur"
      />
      <button
        type="button"
        class="mcombo__toggle"
        tabindex="-1"
        @click="open = !open"
      >
        <ChevronDown :size="16" :class="{ 'mcombo__chevron--open': showPanel }" />
      </button>
    </div>

    <transition name="mcombo">
      <div v-if="showPanel" class="mcombo__menu">
        <button
          v-for="model in filtered"
          :key="model"
          type="button"
          class="mcombo__option"
          :class="{ 'mcombo__option--active': model === modelValue }"
          @mousedown.prevent="pick(model)"
        >
          <span class="mcombo__option-label">{{ model }}</span>
          <Check v-if="model === modelValue" :size="14" class="mcombo__check" />
        </button>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.mcombo {
  position: relative;
  width: 100%;
}

.mcombo__field {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0 var(--space-3);
}

.mcombo__input {
  flex: 1;
  padding: var(--space-3) 0;
  font-size: var(--text-sm);
  color: var(--color-text-primary);
  background: transparent;
  border: none;
  outline: none;
  font-family: 'JetBrains Mono', monospace;
}

.mcombo__input::placeholder {
  color: var(--color-text-muted);
  font-family: inherit;
}

.mcombo__toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: var(--space-1);
  flex-shrink: 0;
}

.mcombo__toggle svg {
  transition: transform var(--duration-fast) var(--ease-out);
}

.mcombo__chevron--open {
  transform: rotate(180deg);
}

.mcombo__menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 100;
  padding: var(--space-1);
  max-height: 240px;
  overflow-y: auto;
  background: var(--glass-modal-bg);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid var(--ov-10);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-pop);
}

.mcombo__option {
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
  font-family: 'JetBrains Mono', monospace;
}

.mcombo__option:hover {
  background: var(--ov-06);
}

.mcombo__option--active {
  background: var(--ov-08);
}

.mcombo__option-label {
  flex: 1;
}

.mcombo__check {
  color: var(--color-text-primary);
  flex-shrink: 0;
}

.mcombo-enter-active,
.mcombo-leave-active {
  transition:
    opacity var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}

.mcombo-enter-from,
.mcombo-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
