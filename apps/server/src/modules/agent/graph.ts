import { Annotation, StateGraph, END } from '@langchain/langgraph';
import { LlmService, ChatMessage } from './llm.service';
import { AnalysisService } from '../analysis/analysis.service';
import { buildChart, isValidChartOption } from './chart-builder';
import {
  intentRouterPrompt,
  sqlGeneratorPrompt,
  analysisPrompt,
  chartAdvisorPrompt,
  quickAdvisorPrompt,
} from './prompts';

// ---- Event types emitted during graph execution ----

export interface AgentEvent {
  type: 'token' | 'sql' | 'table' | 'chart' | 'intent' | 'status';
  data: unknown;
}

export type EmitFn = (event: AgentEvent) => void;

// ---- Graph State ----

export const AgentStateAnnotation = Annotation.Root({
  question: Annotation<string>(),
  intent: Annotation<string>({ reducer: (_prev, next) => next, default: () => 'general' }),
  schema: Annotation<string>({ reducer: (_prev, next) => next, default: () => '' }),
  tableName: Annotation<string>({ reducer: (_prev, next) => next, default: () => '' }),
  sql: Annotation<string | null>({ reducer: (_prev, next) => next, default: () => null }),
  queryResult: Annotation<string | null>({ reducer: (_prev, next) => next, default: () => null }),
  queryColumns: Annotation<string[]>({ reducer: (_prev, next) => next, default: () => [] }),
  // Raw structured rows for deterministic chart building
  queryRows: Annotation<(string | number | null)[][]>({ reducer: (_prev, next) => next, default: () => [] }),
  analysis: Annotation<string>({ reducer: (_prev, next) => next, default: () => '' }),
  chartOption: Annotation<Record<string, unknown> | null>({ reducer: (_prev, next) => next, default: () => null }),
  error: Annotation<string | null>({ reducer: (_prev, next) => next, default: () => null }),
  // Runtime dependencies (not serializable, passed through)
  emit: Annotation<EmitFn>({ reducer: (_prev, next) => next, default: () => () => {} }),
  llmService: Annotation<LlmService>({ reducer: (_prev, next) => next, default: () => null as any }),
  analysisService: Annotation<AnalysisService>({ reducer: (_prev, next) => next, default: () => null as any }),
});

export type AgentState = typeof AgentStateAnnotation.State;

// ---- Helper: non-streaming LLM call ----

async function llmCall(llmService: LlmService, system: string, user: string): Promise<string> {
  const messages: ChatMessage[] = [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
  let result = '';
  await llmService.streamChat(messages, (token) => { result += token; });
  return result.trim();
}

// ---- Node: Intent Router ----

async function intentRouter(state: AgentState): Promise<Partial<AgentState>> {
  const { question, schema, llmService, emit } = state;

  emit({ type: 'status', data: { phase: 'thinking', label: '分析问题意图...' } });

  const response = await llmCall(llmService, intentRouterPrompt(schema), question);

  // Extract intent keyword from response
  const validIntents = ['query', 'compare', 'attribution', 'prediction', 'anomaly', 'statistics', 'advice', 'general'];
  const cleaned = response.toLowerCase().replace(/[^a-z]/g, '');
  const intent = validIntents.includes(cleaned) ? cleaned : 'general';

  emit({ type: 'intent', data: { intent } });

  return { intent };
}

// ---- Node: SQL Generator ----

async function sqlGenerator(state: AgentState): Promise<Partial<AgentState>> {
  const { question, intent, schema, tableName, llmService, analysisService, emit } = state;

  emit({ type: 'status', data: { phase: 'sql', label: '生成查询语句...' } });

  // Get sample rows for context
  let sampleStr = '(no sample data available)';
  try {
    const sample = await analysisService.getSampleRows(tableName, 5);
    if (sample.rows.length > 0) {
      sampleStr = [sample.columns.join(' | '), ...sample.rows.map((r) => r.join(' | '))].join('\n');
    }
  } catch { /* ignore */ }

  const systemPrompt = sqlGeneratorPrompt(question, intent, schema, tableName, sampleStr);
  const sql = await llmCall(llmService, systemPrompt, question);

  // Clean SQL: remove markdown fences if present
  const cleanSql = sql.replace(/^```sql?\s*/i, '').replace(/\s*```$/i, '').trim();

  return { sql: cleanSql };
}

// ---- Node: SQL Executor ----

async function sqlExecutor(state: AgentState): Promise<Partial<AgentState>> {
  const { sql, tableName, analysisService, emit } = state;

  if (!sql) {
    return { queryResult: null, queryColumns: [], queryRows: [] };
  }

  // Emit SQL event
  emit({ type: 'sql', data: { sql, status: 'executing' } });
  emit({ type: 'status', data: { phase: 'executing', label: '执行数据查询...' } });

  try {
    const result = await analysisService.executeQuery(sql, tableName);

    // Emit success
    emit({ type: 'sql', data: { sql, status: 'success', executionTime: result.executionTime } });

    // Emit table data (limit to 50 rows for frontend display)
    const displayRows = result.rows.slice(0, 50);
    emit({
      type: 'table',
      data: { columns: result.columns, rows: displayRows, total: result.rows.length },
    });

    // Format result as text for the analysis agent (limit to 30 rows)
    const textRows = result.rows.slice(0, 30);
    const formatted = [
      result.columns.join(' | '),
      '---',
      ...textRows.map((r) => r.join(' | ')),
      result.rows.length > 30 ? `... (${result.rows.length} rows total)` : '',
    ].filter(Boolean).join('\n');

    return {
      queryResult: formatted,
      queryColumns: result.columns,
      // Keep raw rows (cap at 200) for deterministic chart building
      queryRows: result.rows.slice(0, 200),
    };
  } catch (err) {
    const errorMsg = (err as Error).message;
    emit({ type: 'sql', data: { sql, status: 'error', error: errorMsg } });
    return { queryResult: null, queryColumns: [], queryRows: [], error: errorMsg };
  }
}

// ---- Node: Analyst (streams tokens) ----

async function analyst(state: AgentState): Promise<Partial<AgentState>> {
  const { question, intent, schema, sql, queryResult, llmService, emit } = state;

  emit({ type: 'status', data: { phase: 'analyzing', label: '生成分析结论...' } });

  const systemPrompt = analysisPrompt(question, intent, schema, sql, queryResult);
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: question },
  ];

  let full = '';
  // Stream analysis tokens to the client
  await llmService.streamChat(messages, (token) => {
    full += token;
    emit({ type: 'token', data: { content: token, role: 'assistant' } });
  });

  return { analysis: full };
}

// ---- Node: Quick Advisor (NO SQL, direct suggestion from schema + sample) ----
// 跳过 SQL 查询，直接让 AI 看数据结构和样例行给建议。
// 适用于：用户要业务建议、快速看数据价值、数据集很小不需要复杂查询。
async function quickAdvisor(state: AgentState): Promise<Partial<AgentState>> {
  const { question, schema, tableName, llmService, analysisService, emit } = state;

  emit({ type: 'status', data: { phase: 'advising', label: '快速分析数据结构，生成建议...' } });

  // 拿更多样例行给 AI 参考（20 行而不是 5 行）
  let sampleStr = '(无数据样例可用)';
  try {
    const sample = await analysisService.getSampleRows(tableName, 20);
    if (sample.rows.length > 0) {
      sampleStr = [sample.columns.join(' | '), ...sample.rows.map((r) => r.join(' | '))].join('\n');
    }
  } catch { /* ignore */ }

  const systemPrompt = quickAdvisorPrompt(question, schema, sampleStr);
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: question || '请直接给出建议' },
  ];

  let full = '';
  await llmService.streamChat(messages, (token) => {
    full += token;
    emit({ type: 'token', data: { content: token, role: 'assistant' } });
  });

  return { analysis: full };
}

// ---- Node: Chart Advisor ----
// Strategy: the deterministic builder is the PRIMARY source. It guarantees a
// consistently ordered axis and a chart type matched to the data shape, which
// keeps the report's charts diverse and clean. The LLM is only consulted as a
// fallback when the data is not deterministically chartable.

async function chartAdvisor(state: AgentState): Promise<Partial<AgentState>> {
  const { question, intent, queryResult, queryColumns, queryRows, llmService, emit } = state;

  // No data -> no chart
  if (!queryColumns.length || !queryRows.length) {
    return { chartOption: null };
  }

  // 1) Deterministic build (primary): sorted axis + data-driven type
  const built = buildChart({ columns: queryColumns, rows: queryRows, question, intent });

  let finalOption = built?.option ?? null;
  let finalType = built?.chartType || 'bar';
  let finalTitle = built?.title || '数据可视化';

  // 2) LLM fallback only when the deterministic builder could not chart the data
  if (!finalOption && queryResult) {
    try {
      const systemPrompt = chartAdvisorPrompt(question, intent, queryResult, queryColumns);
      const response = await llmCall(llmService, systemPrompt, 'Generate the ECharts option JSON.');
      const llmOption = extractJson(response);
      if (llmOption && isValidChartOption(llmOption)) {
        finalOption = llmOption;
        finalType = (llmOption.series as any[])?.[0]?.type || 'bar';
        finalTitle = (llmOption.title as { text?: string } | undefined)?.text || '数据可视化';
      }
    } catch {
      // keep finalOption null
    }
  }

  if (finalOption) {
    emit({
      type: 'chart',
      data: { chartType: finalType, option: finalOption, title: finalTitle },
    });
    return { chartOption: finalOption };
  }

  return { chartOption: null };
}

/** Robustly extract a JSON object from an LLM response that may contain
 *  markdown fences, leading prose, or trailing commentary. */
function extractJson(text: string): Record<string, unknown> | null {
  if (!text) return null;

  // Strip markdown code fences
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;

  // Find the outermost balanced { ... } block
  const start = candidate.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let end = -1;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) return null;

  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

// ---- Routing logic ----

function routeAfterIntent(state: AgentState): string {
  // 新增：advice 意图走快速建议路径（不跑 SQL）
  if (state.intent === 'advice' && state.tableName) {
    return 'quickAdvisor';
  }
  const dataIntents = ['query', 'compare', 'statistics', 'anomaly', 'attribution'];
  if (dataIntents.includes(state.intent) && state.tableName) {
    return 'sqlGenerator';
  }
  return 'analyst';
}

// ---- Build the graph ----

export function buildAgentGraph() {
  const graph = new StateGraph(AgentStateAnnotation)
    .addNode('intentRouter', intentRouter)
    .addNode('sqlGenerator', sqlGenerator)
    .addNode('sqlExecutor', sqlExecutor)
    .addNode('analyst', analyst)
    .addNode('chartAdvisor', chartAdvisor)
    .addNode('quickAdvisor', quickAdvisor)  // 新增：快速建议节点
    .addEdge('__start__', 'intentRouter')
    .addConditionalEdges('intentRouter', routeAfterIntent, {
      sqlGenerator: 'sqlGenerator',
      analyst: 'analyst',
      quickAdvisor: 'quickAdvisor',  // 新增路由分支
    })
    .addEdge('sqlGenerator', 'sqlExecutor')
    .addEdge('sqlExecutor', 'analyst')
    .addEdge('analyst', 'chartAdvisor')
    .addEdge('chartAdvisor', END)
    .addEdge('quickAdvisor', END);  // 快速建议直接结束，不画图

  return graph.compile();
}
