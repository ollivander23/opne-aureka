// ============================================
// Report Types
// ============================================

export type ReportFormat = 'pdf' | 'docx';

export type ReportStatus = 'generating' | 'ready' | 'error';

export interface ReportSection {
  type: 'text' | 'table' | 'chart' | 'divider';
  title?: string;
  content?: string;
  tableData?: {
    columns: string[];
    rows: (string | number | null)[][];
  };
  chartConfig?: Record<string, unknown>;
}

export interface ReportMeta {
  id: string;
  userId: string;
  conversationId: string | null;
  title: string;
  sections: ReportSection[];
  format: ReportFormat | null;
  filePath: string | null;
  status: ReportStatus;
  createdAt: string;
}

export interface GenerateReportDto {
  conversationId: string;
  title?: string;
  sections?: number[];
}
