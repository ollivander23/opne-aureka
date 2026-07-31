// ============================================
// Chart Types
// ============================================

export type ChartType =
  | 'bar'
  | 'line'
  | 'pie'
  | 'scatter'
  | 'area'
  | 'radar'
  | 'heatmap'
  | 'funnel'
  | 'gauge'
  | 'table';

export interface ChartConfig {
  type: ChartType;
  title?: string;
  option: Record<string, unknown>;
  dataSource?: {
    sql?: string;
    columns: string[];
    rows: (string | number | null)[][];
  };
}

export interface ChartRecommendation {
  type: ChartType;
  confidence: number;
  reason: string;
}
