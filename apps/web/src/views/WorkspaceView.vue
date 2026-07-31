<script setup lang="ts">
import AppShell from '@/components/layout/AppShell.vue';
import ChatPanel from '@/components/business/ChatPanel.vue';
import UploadZone from '@/components/business/UploadZone.vue';
import DataGrid from '@/components/business/DataGrid.vue';
import JitSheetEditor from '@/components/business/JitSheetEditor.vue';
import { useDatasetStore } from '@/stores/dataset';
import { useUIStore } from '@/stores/ui';
import { computed, ref, watch } from 'vue';
import { api as ofetch } from '@/utils/http';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { PanelRightClose, PanelRightOpen, RefreshCw, Save, Pencil, Table2 } from 'lucide-vue-next';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const datasetStore = useDatasetStore();
const uiStore = useUIStore();
const hasDataset = computed(() => datasetStore.hasActiveDataset);

const PAGE_SIZE = 100;
const EDIT_PAGE_SIZE = 5000;
const currentPage = ref(1);
const previewLoading = ref(false);
const editMode = ref(true);
const saving = ref(false);
const dirty = ref(false);
const sheetEditor = ref<InstanceType<typeof JitSheetEditor> | null>(null);
const editorData = ref<{ columns: string[]; rows: (string | number | null)[][] } | null>(null);

async function fetchPreview(page: number) {
  const dataset = datasetStore.activeDataset;
  if (!dataset) return;

  previewLoading.value = true;
  try {
    const result = await ofetch<any>(`/api/datasets/${dataset.id}/preview`, {
      params: { page, pageSize: PAGE_SIZE },
    });
    datasetStore.setPreviewData({
      columns: result.columns,
      rows: result.rows,
      total: result.total,
    });
    currentPage.value = page;
  } catch {
    uiStore.addToast({ type: 'error', message: 'Failed to load preview' });
  } finally {
    previewLoading.value = false;
  }
}

async function fetchEditorData() {
  const dataset = datasetStore.activeDataset;
  if (!dataset) return;
  try {
    const result = await ofetch<any>(`/api/datasets/${dataset.id}/preview`, {
      params: { page: 1, pageSize: Math.max(EDIT_PAGE_SIZE, dataset.rowCount || PAGE_SIZE) },
    });
    editorData.value = { columns: result.columns, rows: result.rows };
  } catch {
    editorData.value = datasetStore.previewData
      ? { columns: datasetStore.previewData.columns, rows: datasetStore.previewData.rows }
      : null;
  }
}

function handlePageChange(page: number) {
  fetchPreview(page);
}

function handleSheetChange(sheetId: string) {
  datasetStore.setActiveSheet(sheetId);
  fetchPreview(1);
}

function handleReplaceFile() {
  datasetStore.setActiveDataset(null);
  // Drop the dataset id from the URL so a refresh doesn't restore it
  router.replace('/workspace');
}

/**
 * Restore the active dataset from the route's :datasetId after a page refresh.
 * The Pinia store is memory-only, so on reload activeDataset is null even
 * though the URL still points at a dataset — rehydrate it from the backend.
 */
async function restoreFromRoute(datasetId: string | undefined) {
  if (!datasetId || datasetStore.activeDataset?.id === datasetId) return;

  if (!datasetStore.datasets.length) {
    await datasetStore.fetchDatasets();
  }
  const match = datasetStore.datasets.find((d) => d.id === datasetId);
  if (match) {
    datasetStore.setActiveDataset(match);
  } else {
    // Stale link (dataset deleted) -> fall back to the empty workspace
    router.replace('/workspace');
  }
}

watch(
  () => route.params.datasetId as string | undefined,
  (id) => { restoreFromRoute(id); },
  { immediate: true },
);

function handleEditorChange(payload: { dirty: boolean }) {
  dirty.value = payload.dirty;
}

/** Toolbar save: route through the editor's save() so it can mark the
 *  exported data as applied (prevents a full engine reinit afterwards). */
function handleToolbarSave() {
  if (editMode.value && sheetEditor.value) {
    sheetEditor.value.save();
    return;
  }
  handleSaveSheet();
}

async function handleSaveSheet(payload?: { columns: string[]; rows: (string | number | null)[][] }) {
  const dataset = datasetStore.activeDataset;
  if (!dataset || saving.value) return;
  const table = payload ?? sheetEditor.value?.exportTable();
  if (!table) return;

  saving.value = true;
  try {
    const updated = await datasetStore.saveDatasetData(dataset.id, table.columns, table.rows);
    datasetStore.setActiveDataset(updated);
    datasetStore.setPreviewData({ columns: table.columns, rows: table.rows.slice(0, PAGE_SIZE), total: table.rows.length });
    editorData.value = { columns: table.columns, rows: table.rows };
    dirty.value = false;
    currentPage.value = 1;
    uiStore.addToast({ type: 'success', message: t('workspace.saved') || '表格已保存，可直接进行 AI 分析' });
  } catch {
    uiStore.addToast({ type: 'error', message: t('workspace.saveFailed') || '保存失败' });
  } finally {
    saving.value = false;
  }
}

// Fetch preview when dataset becomes active
watch(
  () => datasetStore.activeDataset?.id,
  (id) => {
    if (id) {
      fetchPreview(1);
      fetchEditorData();
    } else {
      editorData.value = null;
    }
  },
  { immediate: true },
);
</script>

<template>
  <AppShell>
    <div class="workspace">
      <div class="workspace__main">
        <template v-if="hasDataset">
          <div class="workspace__toolbar glass">
            <span class="workspace__dataset-name">{{ datasetStore.datasetName }}</span>
            <span class="workspace__meta">
              {{ datasetStore.activeDataset?.rowCount }} {{ t('workspace.rows') }}
              x {{ datasetStore.schema.length }} {{ t('workspace.cols') }}
            </span>
            <button class="workspace__action" :class="{ 'workspace__action--active': editMode }" @click="editMode = !editMode">
              <Pencil v-if="!editMode" :size="14" />
              <Table2 v-else :size="14" />
              <span>{{ editMode ? t('workspace.previewMode') : t('workspace.editMode') }}</span>
            </button>
            <button class="workspace__action workspace__action--primary" :disabled="saving" @click="handleToolbarSave()">
              <Save :size="14" />
              <span>{{ saving ? t('workspace.saving') : dirty ? t('workspace.saveChanges') : t('workspace.saveSheet') }}</span>
            </button>
            <button class="workspace__replace" @click="handleReplaceFile">
              <RefreshCw :size="14" />
              <span>{{ t('workspace.replaceFile') }}</span>
            </button>
          </div>
          <div class="workspace__content">
            <JitSheetEditor
              v-if="editorData && editMode"
              ref="sheetEditor"
              :columns="editorData.columns"
              :rows="editorData.rows"
              :dataset-name="datasetStore.datasetName"
              editable
              @change="handleEditorChange"
              @save="handleSaveSheet"
            />
            <DataGrid
              v-else-if="datasetStore.previewData"
              :columns="datasetStore.previewData.columns"
              :rows="datasetStore.previewData.rows"
              :total="datasetStore.previewData.total"
              :page="currentPage"
              :page-size="PAGE_SIZE"
              :sheets="datasetStore.sheets"
              :active-sheet="datasetStore.activeSheet ?? undefined"
              :schema="datasetStore.schema"
              @page-change="handlePageChange"
              @sheet-change="handleSheetChange"
            />
            <div v-else class="workspace__loading glass-panel">
              <p class="workspace__loading-text">{{ t('workspace.loading') }}</p>
            </div>
          </div>
        </template>
        <template v-else>
          <div class="workspace__empty">
            <UploadZone />
          </div>
        </template>
      </div>

      <div class="workspace__divider" />

      <transition name="slide-right">
        <div v-if="!uiStore.chatPanelCollapsed" class="workspace__chat">
          <ChatPanel />
        </div>
      </transition>

      <button
        class="workspace__chat-toggle"
        @click="uiStore.toggleChatPanel"
      >
        <PanelRightClose v-if="!uiStore.chatPanelCollapsed" :size="16" />
        <PanelRightOpen v-else :size="16" />
      </button>
    </div>
  </AppShell>
</template>

<style scoped>
.workspace {
  display: flex;
  height: 100%;
  position: relative;
}

.workspace__main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.workspace__toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-bottom: var(--glass-border);
}

.workspace__dataset-name {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-text-secondary);
}

.workspace__meta {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  font-family: var(--font-mono);
}

.workspace__action,
.workspace__replace {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  transition: all var(--duration-fast) var(--ease-out);
}

.workspace__action {
  margin-left: auto;
}

.workspace__action + .workspace__action,
.workspace__action + .workspace__replace {
  margin-left: 0;
}

.workspace__action--active,
.workspace__action:not(.workspace__action--primary):hover,
.workspace__replace:hover {
  color: var(--color-text-primary);
  border-color: var(--color-border-hover);
}

.workspace__action--primary {
  color: var(--color-bg-primary);
  background: var(--color-text-primary);
  border-color: var(--color-text-primary);
}

/* Keep the inverted text color on hover — only dim the button slightly.
   (The generic hover rule above would otherwise set text to the same color
   as this button's background, making the label invisible.) */
.workspace__action--primary:hover:not(:disabled) {
  color: var(--color-bg-primary);
  opacity: 0.85;
}

.workspace__action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.workspace__content {
  flex: 1;
  padding: var(--space-4);
  overflow: hidden;
}

.workspace__loading {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.workspace__loading-text {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.workspace__empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-8);
}

.workspace__divider {
  width: 1px;
  background: var(--color-border);
}

.workspace__chat {
  width: var(--chat-panel-width);
  height: 100%;
  overflow: hidden;
}

.workspace__chat-toggle {
  position: absolute;
  right: var(--space-3);
  top: var(--space-3);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  z-index: 10;
  transition: all var(--duration-fast) var(--ease-out);
}

.workspace__chat-toggle:hover {
  color: var(--color-text-primary);
  border-color: var(--color-border-hover);
}

.slide-right-enter-active,
.slide-right-leave-active {
  transition: all var(--duration-normal) var(--ease-out);
}

.slide-right-enter-from,
.slide-right-leave-to {
  width: 0;
  opacity: 0;
}
</style>
