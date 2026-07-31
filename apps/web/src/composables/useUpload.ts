import { ref } from 'vue';
import { api as ofetch } from '@/utils/http';
import { useDatasetStore } from '@/stores/dataset';
import { useUIStore } from '@/stores/ui';
import { isValidFileType, isValidFileSize } from '@aureka/shared';
import type { DatasetMeta } from '@aureka/shared';
import { i18n } from '@/locales';

const { t } = i18n.global;

export function useUpload() {
  const datasetStore = useDatasetStore();
  const uiStore = useUIStore();
  const isUploading = ref(false);
  const dragOver = ref(false);

  async function uploadFile(file: File) {
    if (!isValidFileType(file.name)) {
      uiStore.addToast({ type: 'error', message: t('upload.errorType') });
      return;
    }

    if (!isValidFileSize(file.size)) {
      uiStore.addToast({ type: 'error', message: t('upload.errorSize') });
      return;
    }

    isUploading.value = true;
    datasetStore.setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', file);

    try {
      // Note: ofetch wraps the Fetch API, which does not expose upload
      // progress events, so we show an indeterminate state instead.
      datasetStore.setUploadProgress(-1);
      const result = await ofetch<any>('/api/datasets/upload', {
        method: 'POST',
        body: formData,
      });

      // Map backend response to DatasetMeta and activate
      const dataset: DatasetMeta = {
        id: result.datasetId,
        userId: 'local',
        name: result.name,
        fileType: result.fileType,
        fileSize: result.fileSize,
        rowCount: result.rowCount,
        sheetCount: result.sheetCount,
        status: result.status,
        sheets: (result.sheets ?? [])
          .filter((s: any) => s != null && typeof s === 'object')
          .map((s: any) => ({
            id: String(s.id ?? ''),
            name: String(s.name ?? ''),
            rowCount: Number(s.rowCount ?? 0),
            colCount: Number(s.colCount ?? 0),
          })),
        schema: (result.columns ?? [])
          .filter((c: any) => c != null && typeof c === 'object')
          .map((c: any) => ({
            name: String(c.name ?? ''),
            type: String(c.type ?? 'string'),
            nullable: true,
          })),
        createdAt: result.createdAt,
        updatedAt: result.createdAt,
      };

      datasetStore.setActiveDataset(dataset);
      // Refresh the persisted dataset list so it shows up in the dataset page
      await datasetStore.fetchDatasets();
      uiStore.addToast({ type: 'success', message: t('upload.success', { name: result.name, rows: result.rowCount }) });
      return result;
    } catch (err) {
      uiStore.addToast({ type: 'error', message: t('upload.errorFailed') });
      throw err;
    } finally {
      isUploading.value = false;
      datasetStore.setUploadProgress(0);
    }
  }

  function onDragEnter() {
    dragOver.value = true;
  }

  function onDragLeave() {
    dragOver.value = false;
  }

  function onDrop(files: FileList | null) {
    dragOver.value = false;
    if (files && files.length > 0) {
      uploadFile(files[0]);
    }
  }

  return { isUploading, dragOver, uploadFile, onDragEnter, onDragLeave, onDrop };
}
