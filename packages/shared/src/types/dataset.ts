// ============================================
// Dataset & Table Types
// ============================================

export type FileType = 'csv' | 'xlsx' | 'xls';

export type DatasetStatus = 'uploading' | 'processing' | 'ready' | 'error';

export type ColumnDataType =
  | 'string'
  | 'integer'
  | 'float'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'unknown';

export type SemanticType =
  | 'id'
  | 'name'
  | 'date'
  | 'amount'
  | 'percentage'
  | 'phone'
  | 'email'
  | 'address'
  | 'category'
  | 'metric'
  | 'unknown';

export interface ColumnSchema {
  name: string;
  type: string;
  nullable: boolean;
  semanticType?: SemanticType;
  sampleValues?: (string | number | null)[];
  description?: string;
}

export interface SheetInfo {
  id: string;
  name: string;
  rowCount: number;
  colCount: number;
}

export interface DatasetMeta {
  id: string;
  userId: string;
  name: string;
  fileType: FileType;
  fileSize: number;
  rowCount: number;
  sheetCount: number;
  sheets: SheetInfo[];
  schema: ColumnSchema[];
  status: DatasetStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TableData {
  columns: string[];
  rows: (string | number | null)[][];
  total: number;
  page?: number;
  pageSize?: number;
}

export interface UploadResult {
  datasetId: string;
  name: string;
  rowCount: number;
  sheetCount: number;
  status: DatasetStatus;
}
