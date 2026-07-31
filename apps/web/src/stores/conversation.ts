import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api as ofetch } from '@/utils/http';
import type { SessionMeta, Message, MessageAttachment } from '@aureka/shared';

export const useConversationStore = defineStore('conversation', () => {
  const sessions = ref<SessionMeta[]>([]);
  const activeSession = ref<string | null>(null);
  const messages = ref<Message[]>([]);
  const isStreaming = ref(false);
  const streamingPhase = ref('');
  const suggestedQuestions = ref<string[]>([]);

  const hasActiveSession = computed(() => activeSession.value !== null);
  const lastMessage = computed(() => messages.value[messages.value.length - 1] ?? null);

  function setSessions(list: SessionMeta[]) {
    sessions.value = list;
  }

  /** Load all conversations (with message counts) from the backend. */
  async function fetchSessions() {
    try {
      const list = await ofetch<any[]>('/api/conversations');
      sessions.value = (list ?? []).map((c) => ({
        id: c.id,
        userId: 'local',
        datasetId: null,
        title: c.title,
        messageCount: Number(c.messageCount ?? 0),
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      }));
    } catch {
      sessions.value = [];
    }
  }

  /** Activate a conversation and load its persisted messages. */
  async function loadSession(sessionId: string) {
    activeSession.value = sessionId;
    try {
      const rows = await ofetch<any[]>(`/api/conversations/${sessionId}/messages`);
      messages.value = (rows ?? []).map((m) => ({
        id: m.id,
        conversationId: m.conversationId,
        role: m.role,
        content: m.content,
        attachments: parseAttachments(m.attachments),
        createdAt: m.createdAt,
      }));
    } catch {
      messages.value = [];
    }
  }

  function parseAttachments(raw: unknown): MessageAttachment[] {
    if (Array.isArray(raw)) return raw as MessageAttachment[];
    if (typeof raw === 'string' && raw) {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  function setActiveSession(sessionId: string | null) {
    activeSession.value = sessionId;
    if (!sessionId) {
      messages.value = [];
    }
  }

  function setMessages(list: Message[]) {
    messages.value = list;
  }

  function addMessage(message: Message) {
    messages.value.push(message);
  }

  function addMessageChunk(content: string) {
    const last = messages.value[messages.value.length - 1];
    if (last && last.role === 'assistant') {
      last.content += content;
    }
  }

  function addAttachment(attachment: MessageAttachment) {
    const last = messages.value[messages.value.length - 1];
    if (last && last.role === 'assistant') {
      last.attachments.push(attachment);
    }
  }

  function setStreaming(streaming: boolean) {
    isStreaming.value = streaming;
    if (!streaming) streamingPhase.value = '';
  }

  function setStreamingPhase(phase: string) {
    streamingPhase.value = phase;
  }

  function setSuggestedQuestions(questions: string[]) {
    suggestedQuestions.value = questions;
  }

  function $reset() {
    sessions.value = [];
    activeSession.value = null;
    messages.value = [];
    isStreaming.value = false;
    streamingPhase.value = '';
    suggestedQuestions.value = [];
  }

  return {
    sessions,
    activeSession,
    messages,
    isStreaming,
    streamingPhase,
    suggestedQuestions,
    hasActiveSession,
    lastMessage,
    setSessions,
    fetchSessions,
    loadSession,
    setActiveSession,
    setMessages,
    addMessage,
    addMessageChunk,
    addAttachment,
    setStreaming,
    setStreamingPhase,
    setSuggestedQuestions,
    $reset,
  };
});
