<script setup lang="ts">
import AppShell from '@/components/layout/AppShell.vue';
import MarkdownRenderer from '@/components/common/MarkdownRenderer.vue';
import ChartBlock from '@/components/business/ChartBlock.vue';
import { useI18n } from 'vue-i18n';
import { ref, onMounted, onUnmounted } from 'vue';
import { api as ofetch } from '@/utils/http';
import { FileText, Download, ArrowLeft, Loader2, BarChart3 } from 'lucide-vue-next';

const { t } = useI18n();

interface ReportChart {
  chartType: string;
  title?: string;
  option: Record<string, unknown>;
  source?: string;
}

interface Report {
  id: string;
  conversationId: string;
  title: string;
  content: string;
  charts: ReportChart[];
  status: 'generating' | 'ready' | 'error';
  createdAt: string;
}

const reports = ref<Report[]>([]);
const activeReport = ref<Report | null>(null);
const loading = ref(false);

let pollTimer: ReturnType<typeof setInterval> | null = null;

async function fetchReports(silent = false) {
  if (!silent) loading.value = true;
  try {
    reports.value = await ofetch<Report[]>('/api/reports');
  } catch { /* ignore */ }
  if (!silent) loading.value = false;
}

async function openReport(report: Report) {
  activeReport.value = report;
  // If still generating, start polling so the view updates automatically
  if (report.status === 'generating') {
    startPolling();
  }
}

function downloadReport(report: Report) {
  window.open(`/api/reports/${report.id}/export`, '_blank');
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Polling loop that keeps report status fresh without a manual refresh.
 * - If a generating report is open in the detail view, refresh it.
 * - Otherwise, if any report in the list is still generating, refresh the list.
 * - Stop once nothing is generating.
 */
async function pollTick() {
  if (activeReport.value && activeReport.value.status === 'generating') {
    try {
      const fresh = await ofetch<Report>(`/api/reports/${activeReport.value.id}`);
      activeReport.value = fresh;
      if (fresh.status !== 'generating') {
        // Sync the list badge now that this report reached a terminal state
        await fetchReports(true);
      }
    } catch { /* ignore */ }
    return;
  }

  if (reports.value.some((r) => r.status === 'generating')) {
    await fetchReports(true);
    return;
  }

  stopPolling();
}

function startPolling() {
  stopPolling();
  pollTimer = setInterval(pollTick, 2000);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

onMounted(async () => {
  await fetchReports();
  if (reports.value.some((r) => r.status === 'generating')) {
    startPolling();
  }
});

onUnmounted(stopPolling);
</script>

<template>
  <AppShell>
    <div class="reports">
      <!-- Report Detail View -->
      <template v-if="activeReport">
        <div class="reports__detail-header">
          <button class="reports__back" @click="activeReport = null">
            <ArrowLeft :size="16" />
            <span>{{ t('reports.back') || 'Back' }}</span>
          </button>
          <div class="reports__detail-actions">
            <span
              v-if="activeReport.status === 'generating'"
              class="reports__action reports__action--status"
            >
              <Loader2 :size="14" class="spin" />
              <span>{{ t('reports.generating') || 'Generating...' }}</span>
            </span>
            <button
              v-else-if="activeReport.status === 'ready'"
              class="reports__action"
              @click="downloadReport(activeReport)"
            >
              <Download :size="14" />
              <span>{{ t('reports.export') || 'Export' }}</span>
            </button>
          </div>
        </div>

        <div class="reports__detail-content glass-panel">
          <div v-if="activeReport.status === 'generating'" class="reports__generating">
            <Loader2 :size="24" class="spin" />
            <p>{{ t('reports.generatingHint') || 'AI is generating the report...' }}</p>
          </div>
          <div v-else-if="activeReport.status === 'error'" class="reports__error-state">
            <p>{{ t('reports.errorHint') || 'Report generation failed' }}</p>
          </div>
          <template v-else>
            <MarkdownRenderer :content="activeReport.content" />

            <!-- Visualization section -->
            <div v-if="activeReport.charts && activeReport.charts.length" class="reports__charts">
              <div class="reports__charts-header">
                <BarChart3 :size="16" />
                <span>{{ t('reports.charts') || '可视化分析报表' }}</span>
              </div>
              <div class="reports__charts-grid">
                <div
                  v-for="(chart, idx) in activeReport.charts"
                  :key="idx"
                  class="reports__chart-card"
                >
                  <ChartBlock :option="chart.option" />
                  <p v-if="chart.source" class="reports__chart-caption">{{ chart.source }}</p>
                </div>
              </div>
            </div>
          </template>
        </div>
      </template>

      <!-- Report List View -->
      <template v-else>
        <div class="reports__header">
          <h1 class="reports__title">{{ t('reports.title') }}</h1>
          <p class="reports__desc">{{ t('reports.desc') }}</p>
        </div>

        <div v-if="reports.length" class="reports__list">
          <button
            v-for="report in reports"
            :key="report.id"
            class="reports__item glass-panel--interactive"
            @click="openReport(report)"
          >
            <FileText :size="18" class="reports__item-icon" />
            <div class="reports__item-info">
              <span class="reports__item-title">{{ report.title }}</span>
              <span class="reports__item-meta">
                {{ formatDate(report.createdAt) }}
                <span
                  class="reports__item-status"
                  :class="`reports__item-status--${report.status}`"
                >
                  {{ report.status === 'ready' ? (t('reports.ready') || 'Ready') : report.status === 'generating' ? (t('reports.generating') || 'Generating') : (t('reports.failed') || 'Failed') }}
                </span>
              </span>
            </div>
          </button>
        </div>

        <div v-else class="reports__empty">
          <FileText :size="40" class="reports__empty-icon" />
          <p>{{ t('reports.empty') }}</p>
          <span class="reports__empty-hint">{{ t('reports.emptyHint') }}</span>
        </div>
      </template>
    </div>
  </AppShell>
</template>

<style scoped>
.reports {
  padding: var(--space-8);
  max-width: 900px;
  margin: 0 auto;
  height: 100%;
  overflow-y: auto;
}

.reports__header {
  margin-bottom: var(--space-8);
}

.reports__title {
  font-size: var(--text-2xl);
  font-weight: 700;
  letter-spacing: -0.02em;
  margin-bottom: var(--space-2);
}

.reports__desc {
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
}

/* List */
.reports__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.reports__item {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-5);
  cursor: pointer;
  text-align: left;
  width: 100%;
}

.reports__item-icon {
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.reports__item-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.reports__item-title {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-text-primary);
}

.reports__item-meta {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.reports__item-status {
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 10px;
}

.reports__item-status--ready {
  color: var(--status-success);
  background: rgba(74, 222, 128, 0.1);
}

.reports__item-status--generating {
  color: var(--status-warning);
  background: rgba(250, 204, 21, 0.1);
}

.reports__item-status--error {
  color: var(--status-error);
  background: rgba(248, 113, 113, 0.1);
}

/* Detail */
.reports__detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-6);
}

.reports__back {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  transition: color var(--duration-fast);
}

.reports__back:hover {
  color: var(--color-text-primary);
}

.reports__detail-actions {
  display: flex;
  gap: var(--space-2);
}

.reports__action {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  transition: all var(--duration-fast);
}

.reports__action:hover {
  color: var(--color-text-primary);
  border-color: var(--color-border-hover);
}

.reports__action--status {
  cursor: default;
  color: var(--color-text-muted);
}

.reports__action--status:hover {
  color: var(--color-text-muted);
  border-color: var(--color-border);
}

.reports__detail-content {
  padding: var(--space-6) var(--space-8);
  min-height: 400px;
}

.reports__generating {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  padding: var(--space-12);
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.reports__error-state {
  padding: var(--space-8);
  text-align: center;
  color: var(--status-error);
  font-size: var(--text-sm);
}

/* Charts section */
.reports__charts {
  margin-top: var(--space-8);
  padding-top: var(--space-6);
  border-top: 1px solid var(--color-border);
}

.reports__charts-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: var(--space-5);
}

.reports__charts-grid {
  display: grid;
  /* Charts need real width: a cramped plot forces axis labels to collide,
     which is what makes the dimensions look "messy". */
  grid-template-columns: repeat(auto-fit, minmax(440px, 1fr));
  gap: var(--space-6);
}

.reports__chart-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.reports__chart-caption {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  text-align: center;
  padding: 0 var(--space-3);
}

/* Empty */
.reports__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-12);
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  text-align: center;
}

.reports__empty-icon {
  opacity: 0.3;
}

.reports__empty-hint {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  opacity: 0.7;
}

/* Spinner */
.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
