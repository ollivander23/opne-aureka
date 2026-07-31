// ============================================
// API Request/Response Types
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
}

// Auth
export interface LoginDto {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    role: string;
  };
}

// SSE Events
export type SSEEventType = 'token' | 'sql' | 'table' | 'chart' | 'intent' | 'done' | 'error';

export interface SSETokenEvent {
  content: string;
  role: 'assistant';
}

export interface SSESqlEvent {
  sql: string;
  status: 'success' | 'error' | 'corrected';
  executionTime?: number;
}

export interface SSETableEvent {
  columns: string[];
  rows: (string | number | null)[][];
  total: number;
}

export interface SSEChartEvent {
  type: string;
  option: Record<string, unknown>;
  title?: string;
}

export interface SSEDoneEvent {
  messageId: string;
  tokens: number;
}

export interface SSEErrorEvent {
  code: string;
  message: string;
}
