import { Injectable, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { LlmService } from './llm.service';
import { DatasetService } from '../dataset/dataset.service';
import { AnalysisService } from '../analysis/analysis.service';
import { buildAgentGraph, AgentEvent } from './graph';

interface MessageEvent {
  data: string;
  type?: string;
}

/**
 * AI agent pipeline powered by LangGraph multi-agent architecture.
 * Nodes: IntentRouter -> SQLGenerator -> SQLExecutor -> Analyst -> ChartAdvisor
 * Streams structured SSE events: token, sql, table, chart, intent, done, error.
 */
@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private readonly graph = buildAgentGraph();

  constructor(
    private readonly llmService: LlmService,
    private readonly datasetService: DatasetService,
    private readonly analysisService: AnalysisService,
  ) {}

  /**
   * Run the multi-agent pipeline and return SSE events as an Observable.
   */
  run(question: string, sessionId: string): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      const messageId = uuidv4();
      let tokenCount = 0;

      const emitToken = (content: string) => {
        tokenCount++;
        subscriber.next({
          type: 'token',
          data: JSON.stringify({ content, role: 'assistant' }),
        });
      };

      const emitDone = () => {
        subscriber.next({
          type: 'done',
          data: JSON.stringify({ messageId, tokens: tokenCount }),
        });
        subscriber.complete();
      };

      const emitError = (message: string) => {
        subscriber.next({
          type: 'error',
          data: JSON.stringify({ message }),
        });
        subscriber.complete();
      };

      this.executeGraph(question, sessionId, (event: AgentEvent) => {
        switch (event.type) {
          case 'token': {
            const { content } = event.data as { content: string };
            tokenCount++;
            subscriber.next({
              type: 'token',
              data: JSON.stringify({ content, role: 'assistant' }),
            });
            break;
          }
          case 'sql':
            subscriber.next({ type: 'sql', data: JSON.stringify(event.data) });
            break;
          case 'table':
            subscriber.next({ type: 'table', data: JSON.stringify(event.data) });
            break;
          case 'chart':
            subscriber.next({ type: 'chart', data: JSON.stringify(event.data) });
            break;
          case 'status':
            subscriber.next({ type: 'status', data: JSON.stringify(event.data) });
            break;
          case 'intent':
            // Internal routing event, not forwarded to client
            break;
        }
      })
        .then(emitDone)
        .catch((err: Error) => {
          this.logger.error(`Agent pipeline failed: ${err.message}`);
          emitError(err.message || 'AI service error');
        });

      return () => {
        // Cleanup hook if the client disconnects mid-stream
      };
    });
  }

  /**
   * Execute the LangGraph agent pipeline.
   * Falls back to a guidance message when no API key is configured.
   */
  private async executeGraph(
    question: string,
    _sessionId: string,
    emit: (event: AgentEvent) => void,
  ): Promise<void> {
    if (!this.llmService.isConfigured) {
      await this.streamFallback(emit);
      return;
    }

    // Build dataset context
    const { schema, tableName } = await this.getDatasetContext();

    // Invoke the LangGraph pipeline
    await this.graph.invoke({
      question,
      schema,
      tableName,
      emit,
      llmService: this.llmService,
      analysisService: this.analysisService,
    });
  }

  /** Get the active dataset schema and table name for grounding. */
  private async getDatasetContext(): Promise<{ schema: string; tableName: string }> {
    try {
      const datasets = await this.datasetService.findAll();
      if (!datasets.length) return { schema: '', tableName: '' };

      // Use the most recently created dataset
      const latest = datasets[0];

      // CRITICAL: the DuckDB table name is the sanitized id (non-alphanumeric
      // chars replaced with underscores). We must feed the LLM the SAME sanitized
      // name everywhere, otherwise it generates SQL referencing a non-existent
      // table (e.g. UUID with hyphens) and the query fails.
      const safeTable = latest.id.replace(/[^a-zA-Z0-9_]/g, '_');

      const columns = latest.columns
        .map((c) => `  - "${c.name}" (${c.type})`)
        .join('\n');

      const schema = [
        `Table: "${safeTable}"`,
        `Dataset: ${latest.name}`,
        `Type: ${latest.fileType}`,
        `Rows: ${latest.rowCount}`,
        `Columns:\n${columns}`,
      ].join('\n');

      return { schema, tableName: safeTable };
    } catch {
      return { schema: '', tableName: '' };
    }
  }

  /**
   * Fallback when no LLM API key is configured.
   */
  private async streamFallback(emit: (event: AgentEvent) => void): Promise<void> {
    const text =
      'AI 服务尚未配置 API Key。\n\n' +
      '请通过以下任一方式配置（支持 DeepSeek / OpenAI / Qwen / Kimi 等 OpenAI 兼容服务）：\n\n' +
      '**方式一（推荐）**：进入「设置」页面，在 LLM 配置区域填写 API Key 并保存，无需重启。\n\n' +
      '**方式二**：在项目根目录 `.env` 文件中设置，然后重启后端：\n' +
      '```\nLLM_PROVIDER=deepseek\nLLM_API_KEY=sk-xxxx\nLLM_BASE_URL=https://api.deepseek.com\nLLM_MODEL=deepseek-chat\n```\n\n' +
      '> 注意：如果 `data/settings.json` 中已保存了占位符，请通过设置页面更新或删除该文件。';

    const chunks = text.match(/.{1,8}/gs) ?? [text];
    for (const chunk of chunks) {
      emit({ type: 'token', data: { content: chunk, role: 'assistant' } });
      await new Promise((resolve) => setTimeout(resolve, 15));
    }
  }
}
