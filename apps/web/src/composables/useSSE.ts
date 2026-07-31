import { ref } from 'vue';
import { useConversationStore } from '@/stores/conversation';
import type { Message } from '@aureka/shared';

export function useSSE() {
  const conversationStore = useConversationStore();
  const error = ref<string | null>(null);
  let eventSource: EventSource | null = null;

  function streamChat(sessionId: string, question: string) {
    error.value = null;
    conversationStore.setStreaming(true);

    // Add user message
    const userMessage: Message = {
      id: Math.random().toString(36).slice(2),
      conversationId: sessionId,
      role: 'user',
      content: question,
      attachments: [],
      createdAt: new Date().toISOString(),
    };
    conversationStore.addMessage(userMessage);

    // Add empty assistant message for streaming
    const assistantMessage: Message = {
      id: Math.random().toString(36).slice(2),
      conversationId: sessionId,
      role: 'assistant',
      content: '',
      attachments: [],
      createdAt: new Date().toISOString(),
    };
    conversationStore.addMessage(assistantMessage);

    const url = `/api/conversations/${sessionId}/chat?q=${encodeURIComponent(question)}`;
    eventSource = new EventSource(url);

    eventSource.addEventListener('token', (e) => {
      const data = JSON.parse(e.data);
      conversationStore.setStreamingPhase('');
      conversationStore.addMessageChunk(data.content);
    });

    eventSource.addEventListener('sql', (e) => {
      const data = JSON.parse(e.data);
      conversationStore.addAttachment({ type: 'sql', data });
    });

    eventSource.addEventListener('table', (e) => {
      const data = JSON.parse(e.data);
      conversationStore.addAttachment({ type: 'table', data });
    });

    eventSource.addEventListener('chart', (e) => {
      const data = JSON.parse(e.data);
      conversationStore.addAttachment({ type: 'chart', data });
    });

    eventSource.addEventListener('status', (e) => {
      const data = JSON.parse(e.data);
      conversationStore.setStreamingPhase(data.label || data.phase || '');
    });

    eventSource.addEventListener('done', () => {
      conversationStore.setStreaming(false);
      close();
    });

    eventSource.addEventListener('error', (e) => {
      if (eventSource?.readyState === EventSource.CLOSED) {
        conversationStore.setStreaming(false);
        return;
      }
      try {
        const data = JSON.parse((e as MessageEvent).data);
        error.value = data.message;
        conversationStore.addAttachment({ type: 'error', data });
      } catch {
        error.value = 'Connection lost';
      }
      conversationStore.setStreaming(false);
      close();
    });
  }

  function close() {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  }

  return { streamChat, close, error };
}
