<script setup lang="ts">
import { useUpload } from '@/composables/useUpload';
import { useDatasetStore } from '@/stores/dataset';
import { useI18n } from 'vue-i18n';
import { UploadCloud, FileSpreadsheet } from 'lucide-vue-next';

const { t } = useI18n();
const { isUploading, dragOver, uploadFile, onDragEnter, onDragLeave, onDrop } = useUpload();
const datasetStore = useDatasetStore();

function handleFileInput(e: Event) {
  const target = e.target as HTMLInputElement;
  if (target.files?.length) {
    uploadFile(target.files[0]);
  }
}

function handleDrop(e: DragEvent) {
  e.preventDefault();
  onDrop(e.dataTransfer?.files ?? null);
}
</script>

<template>
  <div
    class="upload-zone glass-panel--interactive"
    :class="{ 'upload-zone--dragover': dragOver, 'upload-zone--uploading': isUploading }"
    @dragenter.prevent="onDragEnter"
    @dragover.prevent
    @dragleave.prevent="onDragLeave"
    @drop.prevent="handleDrop"
  >
    <template v-if="isUploading">
      <div class="upload-zone__progress">
        <FileSpreadsheet :size="32" class="upload-zone__icon" />
        <div class="upload-zone__bar">
          <div
            class="upload-zone__bar-fill"
            :style="{ width: `${datasetStore.uploadProgress}%` }"
          />
        </div>
        <span class="upload-zone__percent">{{ datasetStore.uploadProgress }}%</span>
      </div>
    </template>

    <template v-else>
      <div class="upload-zone__icon-wrapper">
        <UploadCloud :size="32" />
      </div>
      <p class="upload-zone__title">{{ t('upload.dropHere') }}</p>
      <p class="upload-zone__hint">{{ t('upload.clickToBrowse') }}</p>
      <p class="upload-zone__formats">{{ t('upload.formats') }}</p>
      <input
        type="file"
        class="upload-zone__input"
        accept=".csv,.xlsx,.xls"
        @change="handleFileInput"
      />
    </template>
  </div>
</template>

<style scoped>
.upload-zone {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-12) var(--space-8);
  border: 1px dashed var(--ov-12);
  cursor: pointer;
  width: 100%;
  max-width: 480px;
}

.upload-zone--dragover {
  border-color: var(--ov-30);
  background: var(--ov-06);
}

.upload-zone--uploading {
  cursor: default;
}

.upload-zone__icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: var(--radius-lg);
  background: var(--color-accent);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-2);
}

.upload-zone__title {
  font-size: var(--text-base);
  font-weight: 500;
}

.upload-zone__hint {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.upload-zone__formats {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.upload-zone__input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.upload-zone--uploading .upload-zone__input {
  display: none;
}

.upload-zone__progress {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  width: 100%;
}

.upload-zone__icon {
  color: var(--color-text-secondary);
}

.upload-zone__bar {
  width: 100%;
  max-width: 240px;
  height: 4px;
  background: var(--ov-06);
  border-radius: 2px;
  overflow: hidden;
}

.upload-zone__bar-fill {
  height: 100%;
  background: var(--color-text-primary);
  border-radius: 2px;
  transition: width var(--duration-fast) var(--ease-out);
}

.upload-zone__percent {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  font-family: var(--font-mono);
}
</style>
