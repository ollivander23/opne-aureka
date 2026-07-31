// ============================================
// Conversation & Message Types
// ============================================

export type MessageRole = 'user' | 'assistant' | 'system';

export type IntentType =
  | 'query'
  | 'compare'
  | 'attribution'
  | 'prediction'
  | 'anomaly'
  | 'statistics'
  | 'general';

export interface SessionMeta {
  id: string;
  userId: string;
  datasetId: string | null;
  title: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MessageAttachment {
  type: 'sql' | 'table' | 'chart' | 'error';
  data: SqlAttachment | TableAttachment | ChartAttachment | ErrorAttachment;
}

export interface SqlAttachment {
  sql: string;
  status: 'success' | 'error' | 'corrected';
  executionTime?: number;
  error?: string;
}

export interface TableAttachment {
  columns: string[];
  rows: (string | number | null)[][];
  total: number;
}

export interface ChartAttachment {
  chartType: string;
  option: Record<string, unknown>;
  title?: string;
}

export interface ErrorAttachment {
  code: string;
  message: string;
  suggestion?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  attachments: MessageAttachment[];
  intent?: IntentType;
  tokensUsed?: number;
  createdAt: string;
}

export interface CreateConversationDto {
  datasetId?: string;
  title?: string;
}

export interface SendMessageDto {
  content: string;
  context?: {
    selectedRange?: string;
    sheetName?: string;
  };
}
