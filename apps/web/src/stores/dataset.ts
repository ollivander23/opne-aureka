import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api as ofetch } from '@/utils/http';
import type { DatasetMeta, SheetInfo, TableData, ColumnSchema } from '@aureka/shared';

/** Map a backend dataset record to the frontend DatasetMeta shape. */
function mapToMeta(result: any): DatasetMeta {
  return {
    id: result.id ?? result.datasetId,
    userId: 'local',
    name: result.name,
    fileType: result.fileType,
    fileSize: result.fileSize ?? 0,
    rowCount: result.rowCount ?? 0,
    sheetCount: result.sheetCount ?? 0,
    status: result.status ?? 'ready',
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
}

export const useDatasetStore = defineStore('dataset', () => {
  const datasets = ref<DatasetMeta[]>([]);
  const activeDataset = ref<DatasetMeta | null>(null);
  const sheets = ref<SheetInfo[]>([]);
  const activeSheet = ref<string | null>(null);
  const previewData = ref<TableData | null>(null);
  const schema = ref<ColumnSchema[]>([]);
  const uploadProgress = ref(0);
  const isLoading = ref(false);

  const hasActiveDataset = computed(() => activeDataset.value !== null);
  const datasetName = computed(() => activeDataset.value?.name ?? '');

  function setDatasets(list: DatasetMeta[]) {
    datasets.value = list;
  }

  /** Load all datasets from the backend (persisted across restarts). */
  async function fetchDatasets() {
    try {
      const list = await ofetch<any[]>('/api/datasets');
      datasets.value = (list ?? []).map(mapToMeta);
    } catch {
      datasets.value = [];
    }
  }

  /** Delete a dataset on the backend and refresh the list. */
  async function removeDataset(id: string) {
    await ofetch(`/api/datasets/${id}`, { method: 'DELETE' });
    datasets.value = datasets.value.filter((d) => d.id !== id);
    if (activeDataset.value?.id === id) {
      setActiveDataset(null);
    }
  }

  /** Create a blank editable dataset backed by a CSV file + DuckDB table. */
  async function createBlankDataset(name: string) {
    const result = await ofetch<any>('/api/datasets/blank', {
      method: 'POST',
      body: {
        name,
        columns: [
          { name: '项目', type: 'string' },
          { name: '数值', type: 'number' },
          { name: '分类', type: 'string' },
        ],
        rows: [
          ['示例A', '100', '默认'],
          ['示例B', '200', '默认'],
        ],
      },
    });
    const dataset = mapToMeta(result);
    setActiveDataset(dataset);
    await fetchDatasets();
    return dataset;
  }

  /** Persist edited table data and refresh the active dataset metadata. */
  async function saveDatasetData(id: string, columns: string[], rows: (string | number | null)[][]) {
    const result = await ofetch<any>(`/api/datasets/${id}/data`, {
      method: 'PUT',
      body: { columns, rows },
    });
    const dataset = mapToMeta(result);
    if (activeDataset.value?.id === id) {
      activeDataset.value = dataset;
      sheets.value = dataset.sheets;
      schema.value = dataset.schema;
      activeSheet.value = dataset.sheets[0]?.id ?? null;
    }
    await fetchDatasets();
    return dataset;
  }

  function setActiveDataset(dataset: DatasetMeta | null) {
    activeDataset.value = dataset;
    if (dataset) {
      sheets.value = dataset.sheets;
      schema.value = dataset.schema;
      activeSheet.value = dataset.sheets[0]?.id ?? null;
    } else {
      sheets.value = [];
      schema.value = [];
      activeSheet.value = null;
      previewData.value = null;
    }
  }

  function setPreviewData(data: TableData) {
    previewData.value = data;
  }

  function setActiveSheet(sheetId: string) {
    activeSheet.value = sheetId;
  }

  function setUploadProgress(progress: number) {
    uploadProgress.value = progress;
  }

  function setLoading(loading: boolean) {
    isLoading.value = loading;
  }

  function $reset() {
    datasets.value = [];
    activeDataset.value = null;
    sheets.value = [];
    activeSheet.value = null;
    previewData.value = null;
    schema.value = [];
    uploadProgress.value = 0;
    isLoading.value = false;
  }

  return {
    datasets,
    activeDataset,
    sheets,
    activeSheet,
    previewData,
    schema,
    uploadProgress,
    isLoading,
    hasActiveDataset,
    datasetName,
    setDatasets,
    fetchDatasets,
    removeDataset,
    createBlankDataset,
    saveDatasetData,
    setActiveDataset,
    setPreviewData,
    setActiveSheet,
    setUploadProgress,
    setLoading,
    $reset,
  };
});
