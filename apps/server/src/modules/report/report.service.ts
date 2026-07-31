import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { LlmService, ChatMessage } from '../agent/llm.service';
import { ConversationService } from '../conversation/conversation.service';
import { reportGeneratorPrompt } from '../agent/prompts';
import { buildChart } from '../agent/chart-builder';

export interface ReportChart {
  chartType: string;
  title?: string;
  option: Record<string, unknown>;
  /** Question that produced this chart, used as a caption. */
  source?: string;
}

export interface ReportRecord {
  id: string;
  conversationId: string;
  title: string;
  content: string;
  charts: ReportChart[];
  status: 'generating' | 'ready' | 'error';
  createdAt: string;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');

@Injectable()
export class ReportService implements OnModuleInit {
  private readonly logger = new Logger(ReportService.name);
  private db!: Database.Database;

  constructor(
    private readonly llmService: LlmService,
    private readonly conversationService: ConversationService,
  ) {}

  onModuleInit() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    this.db = new Database(path.join(DATA_DIR, 'metadata.db'));
    this.db.pragma('journal_mode = WAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        charts TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'generating',
        created_at TEXT NOT NULL
      );
    `);
    // Migrate older tables that lack the charts column
    const cols = this.db.prepare(`PRAGMA table_info(reports)`).all() as { name: string }[];
    if (!cols.some((c) => c.name === 'charts')) {
      this.db.exec(`ALTER TABLE reports ADD COLUMN charts TEXT NOT NULL DEFAULT '[]'`);
    }
    this.logger.log('ReportService SQLite initialized');
  }

  /** Generate a report from conversation history using LLM. */
  async generate(conversationId: string, title?: string): Promise<ReportRecord> {
    const id = uuidv4();
    const now = new Date().toISOString();
    const reportTitle = title || `数据分析报告 ${now.slice(0, 10)}`;

    // Insert with 'generating' status
    this.db.prepare(
      'INSERT INTO reports (id, conversation_id, title, content, charts, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(id, conversationId, reportTitle, '', '[]', 'generating', now);

    // Generate asynchronously
    this.generateContent(id, conversationId, reportTitle).catch((err) => {
      this.logger.error(`Report generation failed: ${(err as Error).message}`);
      this.db.prepare('UPDATE reports SET status = ? WHERE id = ?').run('error', id);
    });

    return {
      id,
      conversationId,
      title: reportTitle,
      content: '',
      charts: [],
      status: 'generating',
      createdAt: now,
    };
  }

  private async generateContent(reportId: string, conversationId: string, title: string): Promise<void> {
    // Get conversation messages
    const messages = await this.conversationService.getMessages(conversationId);

    if (!messages.length) {
      this.db.prepare('UPDATE reports SET status = ?, content = ? WHERE id = ?')
        .run('error', 'No messages found in this conversation.', reportId);
      return;
    }

    // 1) Aggregate charts already produced during the conversation
    const charts = this.collectCharts(messages);

    // 2) Build conversation summary for the LLM (text only)
    const summary = messages
      .filter((m) => m.role !== 'system')
      .map((m) => {
        const role = m.role === 'user' ? 'User' : 'Assistant';
        return `[${role}]: ${m.content}`;
      })
      .join('\n\n');

    // 3) Call LLM to generate the narrative report
    const systemPrompt = reportGeneratorPrompt(title, summary);
    const llmMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Please generate the full analysis report based on the conversation above.' },
    ];

    let content = '';
    await this.llmService.streamChat(llmMessages, (token) => { content += token; });

    // 4) Persist report content + aggregated charts
    this.db.prepare('UPDATE reports SET status = ?, content = ?, charts = ? WHERE id = ?')
      .run('ready', content, JSON.stringify(charts), reportId);

    this.logger.log(
      `Report ${reportId} generated (${content.length} chars, ${charts.length} charts)`,
    );
  }

  /** Extract chart attachments from conversation messages. */
  private collectCharts(messages: { role: string; content: string; attachments: string }[]): ReportChart[] {
    const charts: ReportChart[] = [];

    // Track the most recent user question to caption each chart
    let lastQuestion = '';

    for (const msg of messages) {
      if (msg.role === 'user') {
        lastQuestion = msg.content;
        continue;
      }
      if (msg.role !== 'assistant' || !msg.attachments) continue;

      try {
        const atts = JSON.parse(msg.attachments) as Array<{ type: string; data: any }>;

        // The raw query result (columns + up to 50 rows) is stored alongside
        // each chart. We use it to rebuild the chart deterministically.
        const table = atts.find((a) => a.type === 'table' && a.data?.columns && a.data?.rows);

        for (const att of atts) {
          if (att.type !== 'chart' || !att.data?.option) continue;

          // Prefer a deterministic rebuild from the raw table: its axis is always
          // a single, consistent dimension. This repairs charts whose stored
          // option was free-formed by the LLM fallback, which could mix values
          // from unrelated columns (e.g. status + priority) on one axis.
          const rebuilt = table
            ? buildChart({ columns: table.data.columns, rows: table.data.rows, question: lastQuestion })
            : null;

          if (rebuilt) {
            const title = att.data.title || rebuilt.title;
            rebuilt.option.title = { ...(rebuilt.option.title as Record<string, unknown>), text: title };
            charts.push({ chartType: rebuilt.chartType, title, option: rebuilt.option, source: lastQuestion });
          } else {
            charts.push({
              chartType: att.data.chartType || 'bar',
              title: att.data.title,
              option: att.data.option,
              source: lastQuestion,
            });
          }
        }
      } catch {
        // Ignore malformed attachment JSON
      }
    }

    return this.dedupeCharts(charts);
  }

  /**
   * Remove duplicate charts. Asking the same (or a similarly phrased) question
   * multiple times yields charts that plot the SAME underlying numbers, even if
   * the titles or chart types differ. We therefore identify a chart purely by
   * its data (axis categories + series values) and keep only one occurrence of
   * each unique dataset, so the report never shows the same numbers twice.
   */
  private dedupeCharts(charts: ReportChart[]): ReportChart[] {
    const seen = new Set<string>();
    const keptValues: number[][] = [];
    const result: ReportChart[] = [];

    // Walk backwards so the most recent version of a chart wins,
    // then restore chronological order for display.
    for (let i = charts.length - 1; i >= 0; i--) {
      const chart = charts[i];
      const signature = this.chartSignature(chart);
      if (seen.has(signature)) continue;

      // Near-duplicate guard: re-asking a summary question produces charts whose
      // labels differ only in wording or language ("总任务数" / "任务总数" /
      // "total_tasks") while plotting the very same numbers. An exact signature
      // cannot catch those, so also compare the numeric payloads.
      const values = this.chartValues(chart);
      if (keptValues.some((kept) => this.valuesOverlap(kept, values))) continue;

      seen.add(signature);
      keptValues.push(values);
      result.unshift(chart);
    }

    return result;
  }

  /** Sorted list of every numeric value plotted by a chart. */
  private chartValues(chart: ReportChart): number[] {
    const series = Array.isArray(chart.option?.series) ? (chart.option.series as any[]) : [];
    const values: number[] = [];

    for (const s of series) {
      const data = Array.isArray(s?.data) ? s.data : [];
      for (const d of data) {
        const raw = d && typeof d === 'object' && !Array.isArray(d) ? d.value : d;
        const n = typeof raw === 'number' ? raw : Number(raw);
        if (Number.isFinite(n)) values.push(n);
      }
    }

    return values.sort((a, b) => a - b);
  }

  /**
   * Two charts are considered the same when their numeric payloads mostly
   * coincide (Jaccard similarity over the value sets). Charts with too few
   * points are exempt, because small sets collide by chance.
   */
  private valuesOverlap(a: number[], b: number[]): boolean {
    if (a.length < 4 || b.length < 4) return false;

    const setA = new Set(a);
    const setB = new Set(b);
    let intersection = 0;
    for (const v of setA) if (setB.has(v)) intersection++;

    const union = setA.size + setB.size - intersection;
    return union > 0 && intersection / union >= 0.7;
  }

  /**
   * Build a data-only identity string for a chart. Deliberately ignores the
   * title and chart type so that two charts plotting identical values are
   * treated as duplicates regardless of how they are labelled or rendered.
   */
  private chartSignature(chart: ReportChart): string {
    const option = chart.option || {};
    const series = Array.isArray(option.series) ? (option.series as any[]) : [];

    // Collect every series' data values (works for bar/line/scatter and pie,
    // where each item is { name, value }).
    const seriesData = series.map((s) => {
      const data = Array.isArray(s?.data) ? s.data : [];
      return data.map((d: any) =>
        d && typeof d === 'object' ? `${d.name ?? ''}:${d.value ?? ''}` : String(d ?? ''),
      );
    });

    const xAxis = (option.xAxis as any)?.data ?? [];
    const yAxis = (option.yAxis as any)?.data ?? [];

    return JSON.stringify({ xAxis, yAxis, series: seriesData });
  }

  /** List all reports. */
  async findAll(): Promise<ReportRecord[]> {
    const rows = this.db.prepare(
      'SELECT id, conversation_id as conversationId, title, content, charts, status, created_at as createdAt FROM reports ORDER BY created_at DESC',
    ).all() as Array<Omit<ReportRecord, 'charts'> & { charts: string }>;

    return rows.map((r) => ({ ...r, charts: this.parseCharts(r.charts) }));
  }

  /** Get a single report by id. */
  async findOne(id: string): Promise<ReportRecord> {
    const row = this.db.prepare(
      'SELECT id, conversation_id as conversationId, title, content, charts, status, created_at as createdAt FROM reports WHERE id = ?',
    ).get(id) as (Omit<ReportRecord, 'charts'> & { charts: string }) | undefined;

    if (!row) throw new NotFoundException('Report not found');
    return { ...row, charts: this.parseCharts(row.charts) };
  }

  private parseCharts(raw: string | undefined | null): ReportChart[] {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /** Export report as Markdown file download. */
  async export(id: string): Promise<{ filename: string; content: string }> {
    const report = await this.findOne(id);
    if (report.status !== 'ready') {
      throw new NotFoundException('Report is not ready for export');
    }

    const filename = `${report.title.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_')}.md`;
    return { filename, content: report.content };
  }
}
