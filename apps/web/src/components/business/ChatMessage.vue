<script setup lang="ts">
import type { Message, ChartAttachment, TableAttachment, SqlAttachment, ErrorAttachment } from '@aureka/shared';
import { User, Bot } from 'lucide-vue-next';
import MarkdownRenderer from '@/components/common/MarkdownRenderer.vue';
import ChartBlock from './ChartBlock.vue';

defineProps<{
  message: Message;
}>();
</script>

<template>
  <div class="message" :class="`message--${message.role}`">
    <div class="message__avatar">
      <User v-if="message.role === 'user'" :size="14" />
      <Bot v-else :size="14" />
    </div>
    <div class="message__body">
      <div class="message__content">
        <!-- User messages: plain text -->
        <p v-if="message.role === 'user' && message.content" class="message__text">{{ message.content }}</p>
        <!-- Assistant messages: rendered markdown -->
        <MarkdownRenderer
          v-else-if="message.role === 'assistant' && message.content"
          :content="message.content"
        />
      </div>

      <div v-if="message.attachments.length" class="message__attachments">
        <template v-for="(att, idx) in message.attachments" :key="idx">
          <!-- SQL attachment with syntax highlight -->
          <div v-if="att.type === 'sql'" class="message__sql glass">
            <div class="message__sql-header">
              <span class="message__sql-label">SQL</span>
              <span
                class="message__sql-status"
                :class="`message__sql-status--${(att.data as SqlAttachment).status}`"
              >
                {{ (att.data as SqlAttachment).status === 'success' ? 'executed' : (att.data as SqlAttachment).status }}
              </span>
            </div>
            <code class="message__sql-code">{{ (att.data as SqlAttachment).sql }}</code>
            <span v-if="(att.data as SqlAttachment).executionTime" class="message__sql-time">
              {{ (att.data as SqlAttachment).executionTime }}ms
            </span>
          </div>

          <!-- Table attachment: mini data grid -->
          <div v-else-if="att.type === 'table'" class="message__table glass">
            <div class="message__table-header">
              <span class="message__table-label">Query Result</span>
              <span class="message__table-count">{{ (att.data as TableAttachment).total }} rows</span>
            </div>
            <div class="message__table-scroll">
              <table class="message__table-grid">
                <thead>
                  <tr>
                    <th v-for="col in (att.data as TableAttachment).columns" :key="col">{{ col }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, rIdx) in (att.data as TableAttachment).rows.slice(0, 10)" :key="rIdx">
                    <td v-for="(cell, cIdx) in row" :key="cIdx">{{ cell ?? '-' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <span v-if="(att.data as TableAttachment).total > 10" class="message__table-more">
              ... {{ (att.data as TableAttachment).total - 10 }} more rows
            </span>
          </div>

          <!-- Chart attachment: ECharts render -->
          <div v-else-if="att.type === 'chart'" class="message__chart">
            <ChartBlock :option="(att.data as ChartAttachment).option" />
          </div>

          <!-- Error attachment -->
          <div v-else-if="att.type === 'error'" class="message__error">
            <span>{{ (att.data as ErrorAttachment).message }}</span>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.message {
  display: flex;
  gap: var(--space-3);
  animation: slide-up var(--duration-normal) var(--ease-out);
}

.message--user {
  flex-direction: row-reverse;
}

.message__avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.message--user .message__avatar {
  background: var(--ov-10);
}

.message__body {
  max-width: 85%;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}

.message--user .message__body {
  align-items: flex-end;
}

.message__content {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  line-height: 1.6;
}

.message--user .message__content {
  background: var(--ov-08);
}

.message--assistant .message__content {
  background: var(--color-surface);
}

.message__text {
  white-space: pre-wrap;
  word-break: break-word;
}

.message__attachments {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: 100%;
}

/* SQL block */
.message__sql {
  padding: var(--space-3);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.message__sql-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-2);
}

.message__sql-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
}

.message__sql-status {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
}

.message__sql-status--success {
  color: var(--status-success);
  background: rgba(74, 222, 128, 0.1);
}

.message__sql-status--error {
  color: var(--status-error);
  background: rgba(248, 113, 113, 0.1);
}

.message__sql-status--executing {
  color: var(--status-warning);
  background: rgba(250, 204, 21, 0.1);
}

.message__sql-code {
  display: block;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  white-space: pre-wrap;
  word-break: break-all;
}

.message__sql-time {
  display: block;
  margin-top: var(--space-1);
  font-size: 10px;
  color: var(--color-text-muted);
  font-family: var(--font-mono);
}

/* Table block */
.message__table {
  padding: var(--space-3);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.message__table-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-2);
}

.message__table-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
}

.message__table-count {
  font-size: 10px;
  color: var(--color-text-muted);
  font-family: var(--font-mono);
}

.message__table-scroll {
  overflow-x: auto;
  max-height: 240px;
  overflow-y: auto;
}

.message__table-grid {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}

.message__table-grid th,
.message__table-grid td {
  padding: 4px 8px;
  border: 1px solid var(--color-border);
  text-align: left;
  white-space: nowrap;
}

.message__table-grid th {
  background: var(--color-table-header-bg);
  font-weight: 600;
  color: var(--color-text-secondary);
  position: sticky;
  top: 0;
  z-index: 1;
}

.message__table-grid td {
  color: var(--color-text-secondary);
}

.message__table-more {
  display: block;
  margin-top: var(--space-1);
  font-size: 10px;
  color: var(--color-text-muted);
}

/* Chart block */
.message__chart {
  width: 100%;
}

/* Error block */
.message__error {
  padding: var(--space-3);
  border-radius: var(--radius-sm);
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  font-size: var(--text-xs);
  color: var(--status-error);
}
</style>
