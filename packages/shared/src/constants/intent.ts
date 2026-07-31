import type { IntentType } from '../types/conversation';

export const INTENT_LABELS: Record<IntentType, string> = {
  query: '数据查询',
  compare: '对比分析',
  attribution: '归因分析',
  prediction: '趋势预测',
  anomaly: '异常检测',
  statistics: '统计概览',
  general: '通用问答',
};

export const INTENT_DESCRIPTIONS: Record<IntentType, string> = {
  query: '查询特定数据或筛选记录',
  compare: '对比不同维度的数据差异',
  attribution: '分析数据变化的原因',
  prediction: '基于历史数据预测未来趋势',
  anomaly: '检测数据中的异常值',
  statistics: '数据整体统计特征概览',
  general: '一般性数据问题',
};
