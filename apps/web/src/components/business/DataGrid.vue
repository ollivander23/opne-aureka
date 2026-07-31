<script setup lang="ts">
import { computed, ref } from 'vue';
import { ChevronLeft, ChevronRight } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = defineProps<{
  columns: string[];
  rows: any[][];
  total: number;
  page: number;
  pageSize: number;
  sheets?: { id: string; name: string; rowCount: number }[];
  activeSheet?: string;
  schema?: { name: string; type: string }[];
}>();

const emit = defineEmits<{
  (e: 'page-change', page: number): void;
  (e: 'sheet-change', sheetId: string): void;
}>();

const scrollContainer = ref<HTMLElement | null>(null);

const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)));

/** Generate Excel-style column letters: A, B, ... Z, AA, AB ... */
function colLetter(index: number): string {
  let result = '';
  let n = index;
  while (n >= 0) {
    result = String.fromCharCode((n % 26) + 65) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}

function typeIcon(type?: string): string {
  switch (type) {
    case 'number': return '#';
    case 'date': return 'D';
    case 'boolean': return 'B';
    default: return 'T';
  }
}

function getColumnType(colName: string): string | undefined {
  return props.schema?.find((s) => s.name === colName)?.type;
}

function cellClass(value: any): string {
  if (value === null || value === undefined || value === '') return 'datagrid__cell--empty';
  if (!isNaN(Number(value))) return 'datagrid__cell--number';
  return '';
}

function formatCell(value: any): string {
  if (value === null || value === undefined) return '';
  return String(value);
}
</script>

<template>
  <div class="datagrid">
    <div ref="scrollContainer" class="datagrid__scroll">
      <table class="datagrid__table">
        <thead>
          <tr class="datagrid__row datagrid__row--header">
            <th class="datagrid__corner" />
            <th
              v-for="(col, ci) in columns"
              :key="ci"
              class="datagrid__th"
            >
              <span class="datagrid__col-letter">{{ colLetter(ci) }}</span>
              <span class="datagrid__col-name" :title="col">{{ col }}</span>
              <span class="datagrid__col-type" :data-type="getColumnType(col)">
                {{ typeIcon(getColumnType(col)) }}
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, ri) in rows"
            :key="ri"
            class="datagrid__row"
          >
            <td class="datagrid__row-num">{{ (page - 1) * pageSize + ri + 1 }}</td>
            <td
              v-for="(cell, ci) in columns"
              :key="ci"
              class="datagrid__cell"
              :class="cellClass(row[ci])"
            >
              {{ formatCell(row[ci]) }}
            </td>
          </tr>
          <tr v-if="rows.length === 0">
            <td :colspan="columns.length + 1" class="datagrid__empty">
              {{ t('workspace.noData') }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="datagrid__footer">
      <div class="datagrid__sheets" v-if="sheets && sheets.length > 0">
        <button
          v-for="sheet in sheets"
          :key="sheet.id"
          class="datagrid__sheet-tab"
          :class="{ 'datagrid__sheet-tab--active': sheet.id === activeSheet }"
          @click="emit('sheet-change', sheet.id)"
        >
          {{ sheet.name }}
        </button>
      </div>
      <div v-else class="datagrid__sheets" />

      <div class="datagrid__pagination">
        <span class="datagrid__page-info">
          {{ t('common.total') }} {{ total }} {{ t('workspace.rows') }}
        </span>
        <div class="datagrid__page-controls">
          <button
            class="datagrid__page-btn"
            :disabled="page <= 1"
            @click="emit('page-change', page - 1)"
          >
            <ChevronLeft :size="14" />
          </button>
          <span class="datagrid__page-num">{{ page }} / {{ totalPages }}</span>
          <button
            class="datagrid__page-btn"
            :disabled="page >= totalPages"
            @click="emit('page-change', page + 1)"
          >
            <ChevronRight :size="14" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.datagrid {
  display: flex;
  flex-direction: column;
  height: 100%;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: var(--color-surface);
}

.datagrid__scroll {
  flex: 1;
  overflow: auto;
}

.datagrid__table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-xs);
  table-layout: auto;
  min-width: max-content;
}

.datagrid__corner {
  position: sticky;
  left: 0;
  top: 0;
  z-index: 3;
  width: 48px;
  min-width: 48px;
  background: var(--color-bg-secondary);
  border-right: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
}

.datagrid__th {
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--color-bg-secondary);
  border-right: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
  padding: var(--space-2) var(--space-3);
  text-align: left;
  white-space: nowrap;
  min-width: 120px;
  max-width: 240px;
}

.datagrid__col-letter {
  display: block;
  font-size: 10px;
  font-weight: 600;
  color: var(--color-text-muted);
  letter-spacing: 0.05em;
  margin-bottom: 2px;
}

.datagrid__col-name {
  display: block;
  font-weight: 500;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}

.datagrid__col-type {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  font-size: 9px;
  font-weight: 700;
  width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  background: var(--ov-06);
  color: var(--color-text-muted);
}

.datagrid__col-type[data-type='number'] {
  color: var(--type-number);
}

.datagrid__col-type[data-type='date'] {
  color: var(--type-date);
}

.datagrid__col-type[data-type='boolean'] {
  color: var(--type-boolean);
}

.datagrid__row-num {
  position: sticky;
  left: 0;
  z-index: 1;
  background: var(--color-bg-secondary);
  border-right: 1px solid var(--color-border);
  padding: var(--space-1) var(--space-2);
  text-align: center;
  font-size: 10px;
  color: var(--color-text-muted);
  font-family: var(--font-mono);
  user-select: none;
}

.datagrid__row:hover .datagrid__cell {
  background: var(--ov-03);
}

.datagrid__row:hover .datagrid__row-num {
  color: var(--color-text-secondary);
}

.datagrid__cell {
  border-right: 1px solid var(--ov-04);
  border-bottom: 1px solid var(--ov-04);
  padding: var(--space-1) var(--space-3);
  color: var(--color-text-secondary);
  white-space: nowrap;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  height: 32px;
}

.datagrid__cell--number {
  font-family: var(--font-mono);
  text-align: right;
  color: var(--color-text-primary);
}

.datagrid__cell--empty {
  color: var(--color-text-muted);
  opacity: 0.4;
}

.datagrid__empty {
  text-align: center;
  padding: var(--space-8);
  color: var(--color-text-muted);
}

.datagrid__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
  padding: 0 var(--space-3);
  height: 36px;
  flex-shrink: 0;
}

.datagrid__sheets {
  display: flex;
  align-items: center;
  gap: 2px;
  overflow-x: auto;
}

.datagrid__sheet-tab {
  padding: var(--space-1) var(--space-3);
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
  border: 1px solid transparent;
  border-bottom: none;
  white-space: nowrap;
  transition: all var(--duration-fast) var(--ease-out);
}

.datagrid__sheet-tab:hover {
  color: var(--color-text-secondary);
}

.datagrid__sheet-tab--active {
  color: var(--color-text-primary);
  background: var(--color-surface);
  border-color: var(--color-border);
}

.datagrid__pagination {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.datagrid__page-info {
  font-size: 11px;
  color: var(--color-text-muted);
  white-space: nowrap;
}

.datagrid__page-controls {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.datagrid__page-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
  transition: all var(--duration-fast) var(--ease-out);
}

.datagrid__page-btn:hover:not(:disabled) {
  color: var(--color-text-primary);
  border-color: var(--color-border-hover);
}

.datagrid__page-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.datagrid__page-num {
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--color-text-secondary);
  min-width: 40px;
  text-align: center;
}
</style>
