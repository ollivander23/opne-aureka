import type { ChartType } from '../types/chart';

export const CHART_TYPE_LABELS: Record<ChartType, string> = {
  bar: '柱状图',
  line: '折线图',
  pie: '饼图',
  scatter: '散点图',
  area: '面积图',
  radar: '雷达图',
  heatmap: '热力图',
  funnel: '漏斗图',
  gauge: '仪表盘',
  table: '数据表格',
};

export const CHART_TYPE_ICONS: Record<ChartType, string> = {
  bar: 'BarChart2',
  line: 'TrendingUp',
  pie: 'PieChart',
  scatter: 'ScatterChart',
  area: 'AreaChart',
  radar: 'Radar',
  heatmap: 'Grid3x3',
  funnel: 'Filter',
  gauge: 'Gauge',
  table: 'Table',
};
