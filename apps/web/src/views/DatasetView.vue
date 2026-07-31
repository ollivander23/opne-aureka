<script setup lang="ts">
import AppShell from '@/components/layout/AppShell.vue';
import UploadZone from '@/components/business/UploadZone.vue';
import GlassModal from '@/components/common/GlassModal.vue';
import { useDatasetStore } from '@/stores/dataset';
import { useUIStore } from '@/stores/ui';
import { formatFileSize, formatRelativeTime } from '@aureka/shared';
import type { DatasetMeta } from '@aureka/shared';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { computed, onMounted, ref } from 'vue';
import { Database, Trash2, Plus } from 'lucide-vue-next';

const { t } = useI18n();
const router = useRouter();
const datasetStore = useDatasetStore();
const uiStore = useUIStore();

const createModalOpen = ref(false);
const newDatasetName = ref('');
const creating = ref(false);
const canCreate = computed(() => newDatasetName.value.trim().length > 0 && !creating.value);

onMounted(() => {
  datasetStore.fetchDatasets();
});

function openDataset(ds: DatasetMeta) {
  datasetStore.setActiveDataset(ds);
  router.push(`/workspace/${ds.id}`);
}

function openCreateModal() {
  newDatasetName.value = t('dataset.defaultName');
  createModalOpen.value = true;
}

async function handleCreateBlank() {
  const name = newDatasetName.value.trim();
  if (!name || creating.value) return;
  creating.value = true;
  try {
    const dataset = await datasetStore.createBlankDataset(name);
    createModalOpen.value = false;
    uiStore.addToast({ type: 'success', message: t('dataset.created') || '数据集已创建' });
    router.push(`/workspace/${dataset.id}`);
  } catch {
    uiStore.addToast({ type: 'error', message: t('dataset.createFailed') || '创建失败' });
  } finally {
    creating.value = false;
  }
}

async function handleDelete(ds: DatasetMeta, e: Event) {
  e.stopPropagation();
  try {
    await datasetStore.removeDataset(ds.id);
    uiStore.addToast({ type: 'success', message: t('dataset.deleted') || 'Dataset deleted' });
  } catch {
    uiStore.addToast({ type: 'error', message: t('dataset.deleteFailed') || 'Failed to delete' });
  }
}
</script>

<template>
  <AppShell>
    <div class="datasets">
      <div class="datasets__header">
        <div>
          <h1 class="datasets__title">{{ t('dataset.title') }}</h1>
          <p class="datasets__desc">{{ t('dataset.desc') }}</p>
        </div>
        <button class="datasets__create glass-panel--interactive" @click="openCreateModal">
          <Plus :size="16" />
          <span>{{ t('dataset.createBlank') }}</span>
        </button>
      </div>

      <UploadZone />

      <div v-if="datasetStore.datasets.length" class="datasets__list">
        <div
          v-for="ds in datasetStore.datasets"
          :key="ds.id"
          class="datasets__item glass-panel--interactive"
          @click="openDataset(ds)"
        >
          <div class="datasets__item-icon">
            <Database :size="20" />
          </div>
          <div class="datasets__item-info">
            <span class="datasets__item-name">{{ ds.name }}</span>
            <span class="datasets__item-meta">
              {{ formatFileSize(ds.fileSize) }} / {{ ds.rowCount }} {{ t('dataset.rows') }} /
              {{ formatRelativeTime(ds.createdAt) }}
            </span>
          </div>
          <button class="datasets__item-action" @click="handleDelete(ds, $event)">
            <Trash2 :size="16" />
          </button>
        </div>
      </div>

      <div v-else class="datasets__empty">
        <p>{{ t('dataset.empty') }}{{ t('dataset.emptyHint') }}</p>
      </div>

      <GlassModal
        :open="createModalOpen"
        :title="t('dataset.createBlank')"
        :confirm-text="creating ? t('common.loading') : t('common.confirm')"
        :confirm-disabled="!canCreate"
        @confirm="handleCreateBlank"
        @close="createModalOpen = false"
      >
        <label class="datasets__field-label" for="new-dataset-name">{{ t('dataset.createName') }}</label>
        <input
          id="new-dataset-name"
          v-model="newDatasetName"
          class="datasets__field-input glass-input"
          :placeholder="t('dataset.defaultName')"
          maxlength="60"
        />
      </GlassModal>
    </div>
  </AppShell>
</template>

<style scoped>
.datasets {
  padding: var(--space-8);
  max-width: 800px;
  margin: 0 auto;
}

.datasets__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-8);
}

.datasets__create {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  color: var(--color-text-primary);
  font-size: var(--text-sm);
  font-weight: 600;
  white-space: nowrap;
}

.datasets__title {
  font-size: var(--text-2xl);
  font-weight: 700;
  letter-spacing: -0.02em;
  margin-bottom: var(--space-2);
}

.datasets__desc {
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
}

.datasets__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-top: var(--space-6);
}

.datasets__item {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4);
}

.datasets__item-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  background: var(--color-accent);
  color: var(--color-text-secondary);
}

.datasets__item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.datasets__item-name {
  font-size: var(--text-sm);
  font-weight: 500;
}

.datasets__item-meta {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.datasets__item-action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  transition: all var(--duration-fast) var(--ease-out);
}

.datasets__item-action:hover {
  color: var(--status-error);
  background: rgba(239, 68, 68, 0.1);
}

.datasets__empty {
  text-align: center;
  padding: var(--space-12);
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.datasets__field-label {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

.datasets__field-input {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
  color: var(--color-text-primary);
}

.datasets__field-input::placeholder {
  color: var(--color-text-muted);
}
</style>
