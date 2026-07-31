<script setup lang="ts">
import { ref, computed } from 'vue';
import { useConversationStore } from '@/stores/conversation';
import { useSSE } from '@/composables/useSSE';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { api as ofetch } from '@/utils/http';
import ChatMessage from './ChatMessage.vue';
import { Send, Sparkles, FileText, Plus, Trash2, Loader2, PieChart, TrendingUp, ArrowRight } from 'lucide-vue-next';

const { t, tm } = useI18n();
const router = useRouter();
const conversationStore = useConversationStore();
const { streamChat } = useSSE();
const input = ref('');
const generatingReport = ref(false);
const textareaRef = ref<HTMLTextAreaElement | null>(null);

interface Suggestion {
  title: string;
  hint: string;
}

// Resolve suggested questions once (cast avoids vue-i18n deep type instantiation in template)
const suggestions = computed(() => tm('chat.suggestions') as unknown as Suggestion[]);

// A matching icon for each suggestion, by position.
const suggestionIcons = [Sparkles, PieChart, TrendingUp];

const hasAssistantMessages = computed(() =>
  conversationStore.messages.some((m) => m.role === 'assistant' && m.content),
);

const streamingPhase = computed(() => conversationStore.streamingPhase);

function handleSend() {
  const question = input.value.trim();
  if (!question || conversationStore.isStreaming) return;

  const sessionId = conversationStore.activeSession ?? 'default';
  streamChat(sessionId, question);
  input.value = '';
  resetTextareaHeight();
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
}

/** Grow the textarea with its content, up to a cap. */
function autoGrow() {
  const el = textareaRef.value;
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
}

function resetTextareaHeight() {
  const el = textareaRef.value;
  if (el) el.style.height = 'auto';
}

function applySuggestion(s: Suggestion) {
  input.value = s.title;
  autoGrow();
  textareaRef.value?.focus();
}

function handleNewConversation() {
  conversationStore.setActiveSession(null);
  conversationStore.setMessages([]);
}

function handleClearMessages() {
  conversationStore.setMessages([]);
}

async function handleGenerateReport() {
  const sessionId = conversationStore.activeSession ?? 'default';
  if (generatingReport.value) return;

  generatingReport.value = true;
  try {
    await ofetch('/api/reports/generate', {
      method: 'POST',
      body: { conversationId: sessionId },
    });
    router.push('/reports');
  } catch { /* ignore */ }
  generatingReport.value = false;
}
</script>

<template>
  <div class="chat-panel">
    <!-- Header: brand + quick actions -->
    <div class="chat-panel__header glass">
      <div class="chat-panel__brand">
        <div class="chat-panel__logo">
          <Sparkles :size="14" />
        </div>
        <span class="chat-panel__title">{{ t('chat.assistant') }}</span>
      </div>
      <div class="chat-panel__actions">
        <button
          class="chat-panel__action-btn"
          :title="t('chat.newConversation')"
          @click="handleNewConversation"
        >
          <Plus :size="15" />
        </button>
        <button
          v-if="hasAssistantMessages"
          class="chat-panel__action-btn"
          :title="t('chat.generateReport')"
          :disabled="generatingReport"
          @click="handleGenerateReport"
        >
          <FileText :size="15" />
        </button>
        <button
          v-if="conversationStore.messages.length"
          class="chat-panel__action-btn chat-panel__action-btn--danger"
          :title="t('chat.clearMessages')"
          @click="handleClearMessages"
        >
          <Trash2 :size="15" />
        </button>
      </div>
    </div>

    <!-- Streaming status bar -->
    <transition name="fade">
      <div v-if="streamingPhase" class="chat-panel__status">
        <Loader2 :size="12" class="chat-panel__status-spinner" />
        <span>{{ streamingPhase }}</span>
      </div>
    </transition>

    <div class="chat-panel__messages">
      <div v-if="!conversationStore.messages.length" class="chat-panel__empty">
        <div class="chat-panel__empty-icon">
          <Sparkles :size="24" />
        </div>
        <p class="chat-panel__empty-title">{{ t('chat.emptyTitle') }}</p>
        <div class="chat-panel__suggestions">
          <button
            v-for="(s, idx) in suggestions"
            :key="idx"
            class="chat-panel__suggestion"
            @click="applySuggestion(s)"
          >
            <span class="chat-panel__suggestion-icon">
              <component :is="suggestionIcons[idx] ?? Sparkles" :size="15" />
            </span>
            <span class="chat-panel__suggestion-body">
              <span class="chat-panel__suggestion-title">{{ s.title }}</span>
              <span class="chat-panel__suggestion-hint">{{ s.hint }}</span>
            </span>
            <ArrowRight :size="14" class="chat-panel__suggestion-arrow" />
          </button>
        </div>
      </div>

      <ChatMessage
        v-for="msg in conversationStore.messages"
        :key="msg.id"
        :message="msg"
      />

      <div v-if="conversationStore.isStreaming && !streamingPhase" class="chat-panel__typing typing-indicator">
        <span /><span /><span />
      </div>
    </div>

    <div class="chat-panel__input-area">
      <div class="chat-panel__input-box" :class="{ 'chat-panel__input-box--active': input.trim() }">
        <textarea
          ref="textareaRef"
          v-model="input"
          class="chat-panel__textarea"
          :placeholder="t('chat.placeholder')"
          rows="1"
          @keydown="handleKeydown"
          @input="autoGrow"
        />
        <button
          class="chat-panel__send"
          :disabled="!input.trim() || conversationStore.isStreaming"
          :title="t('chat.sendHint')"
          @click="handleSend"
        >
          <Send :size="15" />
        </button>
      </div>
      <p class="chat-panel__input-hint">{{ t('chat.sendHint') }}</p>
    </div>
  </div>
</template>

<style scoped>
.chat-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.chat-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  border-bottom: var(--glass-border);
}

.chat-panel__brand {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.chat-panel__logo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: var(--radius-sm);
  background: var(--color-text-primary);
  color: var(--color-bg-primary);
}

.chat-panel__title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text-primary);
  letter-spacing: -0.01em;
}

.chat-panel__actions {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.chat-panel__action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  transition: all var(--duration-fast) var(--ease-out);
}

.chat-panel__action-btn:hover:not(:disabled) {
  color: var(--color-text-primary);
  background: var(--color-accent);
}

.chat-panel__action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.chat-panel__action-btn--danger:hover {
  color: var(--status-error);
  background: rgba(248, 113, 113, 0.1);
}

/* Streaming status bar */
.chat-panel__status {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  font-size: 11px;
  color: var(--color-text-muted);
  background: var(--color-surface);
  border-bottom: var(--glass-border);
}

.chat-panel__status-spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--duration-fast) var(--ease-out);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.chat-panel__messages {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.chat-panel__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: var(--space-4);
}

.chat-panel__empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  background: var(--color-accent);
  color: var(--color-text-muted);
}

.chat-panel__empty-title {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.chat-panel__suggestions {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: 100%;
  max-width: 340px;
}

.chat-panel__suggestion {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  border: var(--glass-border);
  background: var(--glass-bg);
  text-align: left;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.chat-panel__suggestion:hover {
  border-color: var(--color-border-hover);
  background: var(--glass-bg-hover);
  transform: translateX(2px);
}

.chat-panel__suggestion-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  color: var(--color-text-secondary);
  transition: all var(--duration-fast) var(--ease-out);
}

.chat-panel__suggestion:hover .chat-panel__suggestion-icon {
  background: var(--color-text-primary);
  color: var(--color-bg-primary);
}

.chat-panel__suggestion-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.chat-panel__suggestion-title {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-panel__suggestion-hint {
  font-size: 11px;
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-panel__suggestion-arrow {
  flex-shrink: 0;
  color: var(--color-text-muted);
  opacity: 0;
  transform: translateX(-4px);
  transition: all var(--duration-fast) var(--ease-out);
}

.chat-panel__suggestion:hover .chat-panel__suggestion-arrow {
  opacity: 1;
  transform: translateX(0);
}

.chat-panel__typing {
  display: flex;
  gap: 4px;
  padding: var(--space-3);
}

.chat-panel__input-area {
  padding: var(--space-3) var(--space-4);
  border-top: var(--glass-border);
}

.chat-panel__input-box {
  display: flex;
  align-items: flex-end;
  gap: var(--space-2);
  padding: var(--space-2);
  border-radius: var(--radius-md);
  border: var(--glass-border);
  background: var(--glass-bg);
  transition: border-color var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out);
}

.chat-panel__input-box:focus-within {
  border-color: var(--color-border-hover);
  box-shadow: 0 0 0 3px var(--color-accent);
}

.chat-panel__input-box--active .chat-panel__send {
  opacity: 1;
}

.chat-panel__textarea {
  flex: 1;
  resize: none;
  font-size: var(--text-sm);
  line-height: 1.5;
  max-height: 120px;
  padding: var(--space-1) var(--space-2);
  color: var(--color-text-primary);
  background: transparent;
}

/* Override the global :focus-visible outline so the input stays borderless */
.chat-panel__textarea:focus,
.chat-panel__textarea:focus-visible {
  outline: none;
  box-shadow: none;
}

.chat-panel__textarea::placeholder {
  color: var(--color-text-muted);
}

.chat-panel__send {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  background: var(--color-text-primary);
  color: var(--color-bg-primary);
  opacity: 0.35;
  transition: all var(--duration-fast) var(--ease-out);
}

.chat-panel__send:disabled {
  opacity: 0.25;
  cursor: not-allowed;
}

.chat-panel__send:not(:disabled):hover {
  opacity: 0.85;
}

.chat-panel__input-hint {
  margin-top: var(--space-2);
  text-align: center;
  font-size: 10px;
  color: var(--color-text-muted);
  opacity: 0.7;
}
</style>
