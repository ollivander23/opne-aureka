<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const { locale } = useI18n();

const props = defineProps<{
  columns: string[];
  rows: (string | number | null)[][];
  datasetName?: string;
  editable?: boolean;
  minRows?: number;
  minCols?: number;
}>();

const emit = defineEmits<{
  (e: 'save', payload: { columns: string[]; rows: (string | number | null)[][]; snapshot: unknown }): void;
  (e: 'change', payload: { dirty: boolean }): void;
  (e: 'ready'): void;
}>();

const container = ref<HTMLElement | null>(null);
const sdkReady = ref(false);
const sdkError = ref('');
const dirty = ref(false);
let sheet: any = null;
let cssLoaded = false;
let scriptPromise: Promise<void> | null = null;
// Fingerprint of the table data currently applied to the editor. Lets us skip
// a full engine reinit when the parent echoes back the exact data we just
// saved (reinit destroys and recreates Univer, which looks like a page reload).
let appliedKey = '';

function tableKey(columns: readonly string[], rows: readonly (string | number | null)[][]): string {
  return JSON.stringify([columns, rows]);
}

const JIT_BASE = '/vendor/jitword-sdk/sheet/example/lib';

const localeCode = computed(() => locale.value === 'en-US' ? 'en-US' : 'zh-CN');

function ensureProcessPolyfill() {
  if (!window.process) {
    (window as any).process = {
      env: { NODE_ENV: 'production' },
      versions: { node: '' },
      nextTick: (fn: () => void) => setTimeout(fn, 0),
      browser: true,
    };
  }
}

function loadCss() {
  if (cssLoaded || document.querySelector('link[data-jitsheet-css]')) {
    cssLoaded = true;
    return;
  }
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `${JIT_BASE}/univer.css`;
  link.dataset.jitsheetCss = 'true';
  document.head.appendChild(link);
  cssLoaded = true;
}

function loadScript() {
  if (window.JitSheet?.JitSheet) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[data-jitsheet-sdk]') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load JitSheet SDK')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = `${JIT_BASE}/jit-sheet.full.js`;
    script.async = true;
    script.dataset.jitsheetSdk = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load JitSheet SDK'));
    document.body.appendChild(script);
  });
  return scriptPromise;
}

function toSnapshot() {
  const columns = props.columns.length ? props.columns : defaultColumns();
  const minRows = props.minRows ?? 80;
  const minCols = Math.max(props.minCols ?? 12, columns.length);
  const cellData: Record<number, Record<number, { v: string | number | null }>> = {};

  cellData[0] = {};
  columns.forEach((col, ci) => { cellData[0][ci] = { v: col }; });
  props.rows.forEach((row, ri) => {
    cellData[ri + 1] = {};
    columns.forEach((_, ci) => { cellData[ri + 1][ci] = { v: row[ci] ?? '' }; });
  });

  return {
    sheets: {
      sheet_1: {
        id: 'sheet_1',
        name: props.datasetName || 'Sheet1',
        cellData,
        rowCount: Math.max(minRows, props.rows.length + 20),
        columnCount: minCols,
      },
    },
    sheetOrder: ['sheet_1'],
  };
}

function defaultColumns() {
  const count = Math.max(props.minCols ?? 3, 3);
  return Array.from({ length: count }).map((_, idx) => `column_${idx + 1}`);
}

function getCellValue(cell: any) {
  if (cell === null || cell === undefined) return '';
  if (typeof cell === 'object') return cell.v ?? cell.value ?? '';
  return cell;
}

function snapshotToTable(snapshot: any) {
  const sheetId = snapshot?.sheetOrder?.[0] ?? Object.keys(snapshot?.sheets ?? {})[0];
  const firstSheet = sheetId ? snapshot.sheets?.[sheetId] : null;
  const cellData = firstSheet?.cellData ?? {};
  const rowIndexes = Object.keys(cellData).map(Number).filter(Number.isFinite);
  const maxRow = Math.max(0, ...rowIndexes);
  const colIndexes = rowIndexes.flatMap((ri) => Object.keys(cellData[ri] ?? {}).map(Number).filter(Number.isFinite));
  const maxCol = Math.max(0, ...colIndexes, props.columns.length - 1);
  const colCount = maxCol + 1;

  // Univer creates cell entries for touched-but-empty cells (styling, selection,
  // grid padding), so the raw max column index often exceeds the real data width.
  // Keep a column only if it has a header OR at least one non-empty data cell,
  // then cut everything after the last meaningful column. This prevents ghost
  // "column_5"-style headers from leaking into the saved dataset.
  const rawHeaders = Array.from({ length: colCount }).map((_, ci) =>
    String(getCellValue(cellData[0]?.[ci]) ?? '').trim(),
  );
  const colHasData = Array.from({ length: colCount }).map((_, ci) =>
    rowIndexes.some((ri) => {
      if (ri === 0) return false;
      const value = getCellValue(cellData[ri]?.[ci]);
      return value !== '' && value !== null && value !== undefined;
    }),
  );
  let lastCol = -1;
  for (let ci = 0; ci < colCount; ci++) {
    if (rawHeaders[ci] !== '' || colHasData[ci]) lastCol = ci;
  }
  if (lastCol === -1) {
    return { columns: props.columns.length ? [...props.columns] : defaultColumns(), rows: [] };
  }

  const headers = rawHeaders
    .slice(0, lastCol + 1)
    .map((name, ci) => name || `column_${ci + 1}`);

  const rows = Array.from({ length: maxRow }).map((_, offset) => {
    const ri = offset + 1;
    return headers.map((_, ci) => {
      const value = getCellValue(cellData[ri]?.[ci]);
      if (value === '') return null;
      return typeof value === 'number' ? value : String(value);
    });
  }).filter((row) => row.some((cell) => cell !== null && cell !== ''));

  return { columns: headers, rows };
}

async function initSheet() {
  if (!container.value) return;
  sdkError.value = '';
  try {
    ensureProcessPolyfill();
    loadCss();
    await loadScript();
    await nextTick();
    destroySheet();
    const JitSheet = window.JitSheet?.JitSheet;
    if (!JitSheet) throw new Error('JitSheet constructor not found');
    appliedKey = tableKey(props.columns, props.rows);
    sheet = new JitSheet({
      container: container.value,
      locale: localeCode.value,
      editable: props.editable !== false,
      data: toSnapshot(),
      onChange: () => {
        dirty.value = true;
        emit('change', { dirty: true });
      },
      onError: (err: Error) => {
        sdkError.value = err.message;
      },
    });
    sheet.on?.('ready', () => {
      sdkReady.value = true;
      emit('ready');
    });
  } catch (err) {
    sdkError.value = (err as Error).message;
  }
}

function destroySheet() {
  if (sheet?.destroy) sheet.destroy();
  sheet = null;
  sdkReady.value = false;
}

function exportTable() {
  const snapshot = sheet?.data?.getData?.() ?? sheet?.io?.exportJSON?.() ?? toSnapshot();
  const table = snapshotToTable(snapshot);
  return { ...table, snapshot };
}

function save() {
  const payload = exportTable();
  // Mark the exported table as "already applied": when the parent writes it
  // back into props after a successful save, the watcher below will see the
  // same fingerprint and skip the disruptive engine reinit.
  appliedKey = tableKey(payload.columns, payload.rows);
  dirty.value = false;
  emit('change', { dirty: false });
  emit('save', payload);
}

function focus() {
  sheet?.focus?.();
}

onMounted(initSheet);
onBeforeUnmount(destroySheet);

watch(() => [props.columns, props.rows], () => {
  const key = tableKey(props.columns, props.rows);
  if (key === appliedKey) return;
  appliedKey = key;
  if (sheet?.reinit) sheet.reinit(toSnapshot());
}, { deep: true });

defineExpose({ save, exportTable, focus });
</script>

<template>
  <div class="jit-sheet-editor">
    <div ref="container" class="jit-sheet-editor__container" />
    <div v-if="sdkError" class="jit-sheet-editor__error">
      {{ sdkError }}
    </div>
  </div>
</template>

<style scoped>
.jit-sheet-editor {
  position: relative;
  height: 100%;
  min-height: 420px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: var(--color-surface);
}

.jit-sheet-editor__container {
  width: 100%;
  height: 100%;
  min-height: 420px;
  background: #ffffff;
}

.jit-sheet-editor__error {
  position: absolute;
  inset: var(--space-4);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: var(--radius-md);
  background: rgba(239, 68, 68, 0.1);
  color: var(--status-error);
  font-size: var(--text-sm);
}
</style>
