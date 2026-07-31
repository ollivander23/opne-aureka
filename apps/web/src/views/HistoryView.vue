<script setup lang="ts">
import AppShell from '@/components/layout/AppShell.vue';
import { useConversationStore } from '@/stores/conversation';
import { formatRelativeTime } from '@aureka/shared';
import type { SessionMeta } from '@aureka/shared';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { onMounted } from 'vue';
import { MessageSquare } from 'lucide-vue-next';

const { t } = useI18n();
const router = useRouter();
const conversationStore = useConversationStore();

onMounted(() => {
  conversationStore.fetchSessions();
});

async function openSession(session: SessionMeta) {
  await conversationStore.loadSession(session.id);
  router.push('/workspace');
}
</script>

<template>
  <AppShell>
    <div class="history">
      <div class="history__header">
        <h1 class="history__title">{{ t('history.title') }}</h1>
        <p class="history__desc">{{ t('history.desc') }}</p>
      </div>

      <div v-if="conversationStore.sessions.length" class="history__list">
        <div
          v-for="session in conversationStore.sessions"
          :key="session.id"
          class="history__item glass-panel--interactive"
          @click="openSession(session)"
        >
          <div class="history__item-icon">
            <MessageSquare :size="18" />
          </div>
          <div class="history__item-info">
            <span class="history__item-title">{{ session.title || t('history.untitled') }}</span>
            <span class="history__item-meta">
              {{ session.messageCount }} {{ t('history.messages') }} / {{ formatRelativeTime(session.updatedAt) }}
            </span>
          </div>
        </div>
      </div>

      <div v-else class="history__empty">
        <MessageSquare :size="40" class="history__empty-icon" />
        <p>{{ t('history.empty') }}</p>
      </div>
    </div>
  </AppShell>
</template>

<style scoped>
.history {
  padding: var(--space-8);
  max-width: 800px;
  margin: 0 auto;
}

.history__header {
  margin-bottom: var(--space-8);
}

.history__title {
  font-size: var(--text-2xl);
  font-weight: 700;
  letter-spacing: -0.02em;
  margin-bottom: var(--space-2);
}

.history__desc {
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
}

.history__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.history__item {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4);
  cursor: pointer;
}

.history__item-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  color: var(--color-text-secondary);
}

.history__item-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.history__item-title {
  font-size: var(--text-sm);
  font-weight: 500;
}

.history__item-meta {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.history__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-12);
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.history__empty-icon {
  opacity: 0.3;
}
</style>
