/**
 * Deterministic chart builder.
 * Builds ECharts options directly from query results using heuristic rules.
 * Acts as the PRIMARY chart source (with LLM as a fallback) so that every
 * chart has a clean, consistently ordered axis and a type that matches the
 * shape of the data. This keeps the report's visualization section diverse
 * (bar / line / pie / horizontal-bar / scatter) instead of a wall of bars.
 */

export interface ChartBuildInput {
  columns: string[];
  rows: (string | number | null)[][];
  question?: string;
  intent?: string;
}

export type ChartType = 'bar' | 'line' | 'pie' | 'scatter' | 'hbar';

export interface BuiltChart {
  chartType: ChartType;
  option: Record<string, unknown>;
  title: string;
}

const MAX_SERIES_ITEMS = 20;

/** Detect if a column's values are numeric. */
function isNumericColumn(rows: (string | number | null)[][], colIdx: number): boolean {
  const sample = rows.slice(0, 50).map((r) => r[colIdx]).filter((v) => v !== null && v !== '');
  if (sample.length === 0) return false;
  return sample.every((v) => typeof v === 'number' || (typeof v === 'string' && v !== '' && !isNaN(Number(v))));
}

/** Detect if values look like dates/times. */
function isDateColumn(rows: (string | number | null)[][], colIdx: number): boolean {
  const sample = rows.slice(0, 20).map((r) => r[colIdx]).filter((v) => v !== null && v !== '');
  if (sample.length === 0) return false;
  const datePattern = /^\d{4}[-/]\d{1,2}([-/]\d{1,2})?/;
  const matches = sample.filter((v) => datePattern.test(String(v))).length;
  return matches / sample.length >= 0.7;
}

/**
 * Convert any cell to a finite number, or null.
 *
 * Values are rounded to two decimals because computed measures (ratios,
 * averages) arrive as long floats like 44.44444444444444, which make axis
 * labels and tooltips unreadable. Magnitudes below 1 are left untouched so
 * small but meaningful values are not flattened to zero.
 */
function toNum(v: string | number | null): number | null {
  if (v === null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  if (Number.isInteger(n) || Math.abs(n) < 1) return n;
  return Math.round(n * 100) / 100;
}

/** Sort rows by a numeric column, descending. */
function sortByValueDesc(rows: (string | number | null)[][], numIdx: number) {
  return [...rows].sort((a, b) => (toNum(b[numIdx]) ?? -Infinity) - (toNum(a[numIdx]) ?? -Infinity));
}

/** Sort rows by the dimension column ascending (natural/numeric aware). */
function sortByDimAsc(rows: (string | number | null)[][], dimIdx: number) {
  const copy = [...rows];
  const allNumeric = copy.every((r) => r[dimIdx] === null || toNum(r[dimIdx]) !== null);
  if (allNumeric) {
    copy.sort((a, b) => (toNum(a[dimIdx]) ?? 0) - (toNum(b[dimIdx]) ?? 0));
  } else {
    copy.sort((a, b) =>
      String(a[dimIdx] ?? '').localeCompare(String(b[dimIdx] ?? ''), 'zh-Hans-CN', { numeric: true }),
    );
  }
  return copy;
}

/** Generate a short Chinese title from the question. */
function makeTitle(question: string | undefined, chartType: ChartType, dimCol: string): string {
  const typeLabel: Record<ChartType, string> = {
    bar: '对比图',
    line: '趋势图',
    pie: '占比图',
    scatter: '散点图',
    hbar: '排行图',
  };
  if (question && question.length <= 30) {
    return question.replace(/[?？。.]$/, '');
  }
  return `${dimCol} ${typeLabel[chartType] || '可视化'}`;
}

/** Detect whether the question asks for a proportion / share breakdown. */
function isProportionQuestion(question: string | undefined): boolean {
  if (!question) return false;
  return /占比|比例|构成|分布|份额|比重|proportion|share|distribution|breakdown/i.test(question);
}

/**
 * Declarative label config for a category axis. Uses ECharts' built-in
 * truncation instead of a formatter function, because report charts are
 * persisted as JSON (functions would be lost on serialization).
 */
function categoryLabel(categories: string[], horizontal = false) {
  const longest = categories.reduce((max, c) => Math.max(max, c.length), 0);
  if (horizontal) {
    // Vertical axis: labels stack, so give them width instead of rotation.
    return { rotate: 0, hideOverlap: true, width: 104, overflow: 'truncate', ellipsis: '…' };
  }
  const dense = categories.length > 8;
  const rotate = dense ? 35 : longest > 6 ? 20 : 0;
  return {
    rotate,
    hideOverlap: true,
    width: 84,
    overflow: 'truncate',
    ellipsis: '…',
  };
}

/** Consistent title block so every chart reserves the same headroom. */
function titleBlock(text: string) {
  return { text, left: 'center', top: 10 };
}

/**
 * Grid that leaves room for the title, rotated labels and an optional legend,
 * so plots never collide with surrounding text.
 */
function gridBlock(opts: { rotated?: boolean; legend?: boolean; horizontal?: boolean } = {}) {
  const bottom = opts.legend ? (opts.rotated ? 72 : 48) : opts.rotated ? 56 : 28;
  return {
    top: 58,
    left: opts.horizontal ? 16 : 12,
    right: 24,
    bottom,
    containLabel: true,
  };
}

/** Value labels are helpful when there are few data points, noisy when many. */
function valueLabel(count: number, position: 'top' | 'right') {
  if (count > 12) return { show: false };
  // No explicit color: the label then falls back to the frontend theme's
  // textStyle, which keeps contrast right in both dark and light mode.
  // (Inheriting the series color makes labels blend into the background.)
  return { show: true, position, fontSize: 10 };
}

/**
 * Semantic hint parsed from the analytical question. The wording of the question
 * is the strongest signal for which chart actually answers it, so we read it
 * before falling back to pure data-shape heuristics.
 */
type QuestionHint = 'trend' | 'ranking' | 'comparison' | 'correlation' | 'proportion' | 'none';

function detectQuestionHint(question: string | undefined): QuestionHint {
  if (!question) return 'none';
  const q = question;

  // Time evolution -> line
  if (/趋势|走势|变化|增长|逐(月|日|年|周|季)|按(月|日|年|周|季)|时间|同比|环比|trend|over time|growth|monthly|daily|yearly/i.test(q)) {
    return 'trend';
  }
  // Ranking / top-N -> horizontal bar
  if (/排行|排名|top\s*\d*|前\s*\d+|最(多|少|高|低|大|小)|领先|榜|ranking|rank|highest|lowest/i.test(q)) {
    return 'ranking';
  }
  // Relationship between two measures -> scatter
  if (/相关|关系|关联|散点|correlation|relationship|versus|\bvs\b/i.test(q)) {
    return 'correlation';
  }
  // Share of whole -> pie
  if (isProportionQuestion(q)) return 'proportion';
  // Explicit comparison -> grouped/vertical bar
  if (/对比|比较|差异|各(个)?|每(个)?|compare|comparison|difference|by\s+\w+/i.test(q)) {
    return 'comparison';
  }
  return 'none';
}

/**
 * Decide the most appropriate chart type.
 *
 * Priority: what the QUESTION asks for (as long as the data can express it),
 * then the intent classified by the router, then the raw data shape. This makes
 * the report's charts actually match the analysis narrative instead of
 * defaulting every result to a bar chart.
 */
function decideChartType(
  intent: string | undefined,
  dateColIdx: number | undefined,
  categoricalCols: number[],
  numericCols: number[],
  rowCount: number,
  question: string | undefined,
): ChartType {
  const hint = detectQuestionHint(question);
  const hasTime = dateColIdx !== undefined;
  const singleMetric = numericCols.length === 1 && categoricalCols.length >= 1;
  const multiMetric = numericCols.length >= 2;

  // 1) Honour the question's intent when the data supports that chart
  if (hint === 'correlation' && multiMetric) {
    return 'scatter';
  }
  if (hint === 'trend' && (hasTime || rowCount >= 3)) {
    return 'line';
  }
  if (hint === 'ranking' && singleMetric && rowCount >= 3) {
    return 'hbar';
  }
  if (hint === 'proportion' && categoricalCols.length >= 1 && numericCols.length >= 1 && rowCount >= 2 && rowCount <= 12) {
    // A share question is answered by a pie even when the result also carries a
    // pre-computed percentage column alongside the raw count.
    return 'pie';
  }
  if (hint === 'comparison' && (singleMetric || multiMetric)) {
    // Long category labels read far better lying down
    return rowCount > 8 ? 'hbar' : 'bar';
  }

  // 2) Time dimension always implies a trend, even without wording cues
  if (hasTime) return 'line';

  // 3) Two pure measures with no category -> correlation
  if (multiMetric && categoricalCols.length === 0) return 'scatter';

  // 4) Router intent
  if (singleMetric && intent === 'attribution') return 'pie';
  if (intent === 'prediction' || intent === 'anomaly') return 'line';

  // 5) Data-shape fallback
  if (singleMetric) {
    if (rowCount > 8) return 'hbar';
    if (rowCount >= 2 && rowCount <= 5 && intent !== 'compare') return 'pie';
    return 'bar';
  }

  return 'bar';
}

/**
 * Detect and chart "KPI summary" result shapes that the generic path mishandles.
 *
 * Two shapes are recognised:
 *  1. A wide single-row table (1 row x N metric columns), e.g. the result of
 *     `SELECT COUNT(*) AS total, COUNT(CASE ...) AS done, ... FROM t`. The
 *     generic path would draw a meaningless single-point line; here each
 *     numeric column becomes one (metric, value) bar.
 *  2. A two-column "metric -> value" table whose value column is NOT uniformly
 *     numeric (e.g. a UNION of heterogeneous indicators where some rows hold
 *     dates or text lists). Only the numeric rows are kept.
 *
 * Both shapes are rendered as a horizontal bar chart whose axis is a single,
 * consistent dimension (the metric names). This guarantees the axis never
 * mixes values from unrelated source fields. Returns null when the data does
 * not match either shape, so the generic path proceeds as usual.
 */
function tryBuildKpiChart(
  columns: string[],
  rows: (string | number | null)[][],
  question: string | undefined,
): BuiltChart | null {
  // Shape 1: single row, many columns -> transpose the numeric columns.
  if (rows.length === 1) {
    const pairs: { name: string; value: number }[] = [];
    columns.forEach((col, idx) => {
      const n = toNum(rows[0][idx]);
      if (n !== null) pairs.push({ name: col, value: n });
    });
    return pairs.length >= 2 ? buildKpiHBar(pairs, question) : null;
  }

  // Shape 2: two columns [label, value] where the value column is heterogeneous.
  // (A uniformly numeric value column is already handled well by the generic path.)
  if (columns.length === 2 && !isNumericColumn(rows, 1)) {
    const pairs = rows
      .map((r) => ({ name: String(r[0] ?? '').trim(), value: toNum(r[1]) }))
      .filter((p): p is { name: string; value: number } => p.value !== null && p.name !== '');
    return pairs.length >= 2 ? buildKpiHBar(pairs, question) : null;
  }

  return null;
}

/** Donut chart of (metric, value) pairs for composition questions. */
function buildKpiPie(pairs: { name: string; value: number }[], question: string | undefined): BuiltChart {
  const data = [...pairs]
    .sort((a, b) => b.value - a.value)
    .filter((p) => p.value > 0)
    .map((p) => ({ name: p.name, value: p.value }));

  const title = makeTitle(question, 'pie', '指标');

  const option: Record<string, unknown> = {
    title: titleBlock(title),
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { type: 'scroll', bottom: 8, itemGap: 16 },
    series: [
      {
        name: '数值',
        type: 'pie',
        radius: ['42%', '68%'],
        center: ['50%', '54%'],
        avoidLabelOverlap: true,
        minAngle: 3,
        itemStyle: { borderRadius: 6 },
        label: { show: true, formatter: '{b}\n{d}%', fontSize: 11, lineHeight: 15 },
        labelLine: { length: 10, length2: 12, smooth: true },
        emphasis: { scale: true, scaleSize: 6 },
        data,
      },
    ],
  };

  return { chartType: 'pie', option, title };
}

/** Horizontal bar chart of (metric, value) pairs, largest at the top. */
function buildKpiHBar(pairs: { name: string; value: number }[], question: string | undefined): BuiltChart {
  // A composition question over a handful of comparable metrics reads much
  // better as a donut than as a bar list.
  if (detectQuestionHint(question) === 'proportion' && pairs.length >= 3 && pairs.length <= 8) {
    return buildKpiPie(pairs, question);
  }

  // Sort descending then reverse so the largest renders at the TOP
  // (ECharts draws y-axis categories from bottom to top).
  const top = [...pairs].sort((a, b) => b.value - a.value).slice(0, MAX_SERIES_ITEMS);
  const ordered = [...top].reverse();

  const title = makeTitle(question, 'hbar', '指标');

  const names = ordered.map((p) => p.name);

  const option: Record<string, unknown> = {
    title: titleBlock(title),
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: gridBlock({ horizontal: true }),
    xAxis: { type: 'value' },
    yAxis: {
      type: 'category',
      data: names,
      axisLabel: categoryLabel(names, true),
    },
    series: [
      {
        name: '数值',
        type: 'bar',
        data: ordered.map((p) => p.value),
        barMaxWidth: 22,
        itemStyle: { borderRadius: [0, 4, 4, 0] },
        label: valueLabel(names.length, 'right'),
      },
    ],
  };

  return { chartType: 'hbar', option, title };
}

/**
 * Build an ECharts option deterministically from query results.
 * Returns null only when the data is fundamentally not chartable
 * (e.g. single scalar value, no numeric columns).
 */
export function buildChart(input: ChartBuildInput): BuiltChart | null {
  const { columns, rows, question, intent } = input;

  if (!columns.length || !rows.length) return null;

  // KPI / summary shapes (a wide single row of metrics, or a two-column
  // "metric -> value" table whose value column mixes numbers with dates/text)
  // are transposed into a clean metric bar chart BEFORE the generic path.
  // Left to the generic path they either emit a meaningless single-point line
  // or bail out to the LLM, whose free-form axes end up mixing values from
  // unrelated fields (e.g. status + priority + delay on one axis).
  const kpi = tryBuildKpiChart(columns, rows, question);
  if (kpi) return kpi;

  // Identify numeric and categorical columns
  const numericCols: number[] = [];
  const categoricalCols: number[] = [];
  columns.forEach((_, idx) => {
    if (isNumericColumn(rows, idx)) numericCols.push(idx);
    else categoricalCols.push(idx);
  });

  // Need at least one numeric column to chart
  if (numericCols.length === 0) return null;

  // Single scalar value -> not chartable
  if (rows.length === 1 && numericCols.length === 1 && categoricalCols.length === 0) {
    return null;
  }

  const dateColIdx = categoricalCols.find((idx) => isDateColumn(rows, idx));
  const chartType = decideChartType(intent, dateColIdx, categoricalCols, numericCols, rows.length, question);

  switch (chartType) {
    case 'pie': {
      // Prefer the absolute measure over a pre-computed percentage column, so
      // the tooltip shows real counts while ECharts derives the share itself.
      const pieNumIdx =
        numericCols.find((idx) => !/pct|percent|ratio|rate|占比|比例|百分比|%/i.test(columns[idx])) ??
        numericCols[0];
      return buildPie(columns, rows, categoricalCols[0] ?? 0, pieNumIdx, question);
    }
    case 'scatter':
      return buildScatter(columns, rows, numericCols[0], numericCols[1] ?? numericCols[0], question);
    case 'hbar':
      return buildHBar(columns, rows, categoricalCols[0] ?? 0, numericCols[0], question);
    default:
      return buildCategoryChart(chartType, columns, rows, categoricalCols, numericCols, dateColIdx, question);
  }
}

/** Bar / Line chart with one category axis and one or more numeric series. */
function buildCategoryChart(
  chartType: 'bar' | 'line',
  columns: string[],
  rows: (string | number | null)[][],
  categoricalCols: number[],
  numericCols: number[],
  dateColIdx: number | undefined,
  question: string | undefined,
): BuiltChart {
  // Pick the dimension column: prefer date column, else first categorical, else first column
  const dimIdx = dateColIdx ?? categoricalCols[0] ?? 0;
  const dimName = columns[dimIdx];

  // Order rows so the axis is clean and consistent:
  //  - line (trend / ordered axis) -> dimension ascending
  //  - bar (comparison) -> primary metric descending (largest first)
  const primaryNumIdx = numericCols.find((idx) => idx !== dimIdx) ?? numericCols[0];
  const orderedRows =
    chartType === 'line' ? sortByDimAsc(rows, dimIdx) : sortByValueDesc(rows, primaryNumIdx);

  const limitedRows = orderedRows.slice(0, MAX_SERIES_ITEMS);
  const categories = limitedRows.map((r) => String(r[dimIdx] ?? ''));

  // Build a series for each numeric column (max 4 series)
  const seriesCols = numericCols.filter((idx) => idx !== dimIdx).slice(0, 4);
  const finalSeriesCols = seriesCols.length > 0 ? seriesCols : numericCols.slice(0, 1);

  const series = finalSeriesCols.map((numIdx) => ({
    name: columns[numIdx],
    type: chartType,
    smooth: chartType === 'line',
    data: limitedRows.map((r) => toNum(r[numIdx])),
    ...(chartType === 'bar'
      ? {
          barMaxWidth: 38,
          itemStyle: { borderRadius: [4, 4, 0, 0] },
          label: finalSeriesCols.length === 1 ? valueLabel(categories.length, 'top') : { show: false },
        }
      : {}),
    ...(chartType === 'line'
      ? {
          showSymbol: categories.length <= 24,
          symbolSize: 6,
          lineStyle: { width: 2 },
          ...(finalSeriesCols.length === 1 ? { areaStyle: { opacity: 0.12 } } : {}),
        }
      : {}),
  }));

  const title = makeTitle(question, chartType, dimName);
  const label = categoryLabel(categories);
  const hasLegend = finalSeriesCols.length > 1;

  const option: Record<string, unknown> = {
    title: titleBlock(title),
    tooltip: { trigger: 'axis', axisPointer: { type: chartType === 'bar' ? 'shadow' : 'line' } },
    ...(hasLegend ? { legend: { bottom: 8, type: 'scroll', itemGap: 16 } } : {}),
    grid: gridBlock({ rotated: (label.rotate ?? 0) > 0, legend: hasLegend }),
    xAxis: {
      type: 'category',
      data: categories,
      boundaryGap: chartType === 'bar',
      axisLabel: label,
    },
    yAxis: { type: 'value', name: finalSeriesCols.length === 1 ? columns[finalSeriesCols[0]] : undefined },
    series,
  };

  return { chartType, option, title };
}

/** Horizontal bar chart for ranking many categories by a single metric. */
function buildHBar(
  columns: string[],
  rows: (string | number | null)[][],
  catIdx: number,
  numIdx: number,
  question: string | undefined,
): BuiltChart {
  // Top-N by value, then reverse so the largest renders at the TOP of the chart
  // (ECharts draws y-axis categories from bottom to top).
  const top = sortByValueDesc(rows, numIdx).slice(0, MAX_SERIES_ITEMS);
  const ordered = [...top].reverse();

  const categories = ordered.map((r) => String(r[catIdx] ?? ''));
  const data = ordered.map((r) => toNum(r[numIdx]));

  const title = makeTitle(question, 'hbar', columns[catIdx]);

  const option: Record<string, unknown> = {
    title: titleBlock(title),
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: gridBlock({ horizontal: true }),
    xAxis: { type: 'value', name: columns[numIdx] },
    yAxis: { type: 'category', data: categories, axisLabel: categoryLabel(categories, true) },
    series: [
      {
        name: columns[numIdx],
        type: 'bar',
        data,
        barMaxWidth: 22,
        itemStyle: { borderRadius: [0, 4, 4, 0] },
        label: valueLabel(categories.length, 'right'),
      },
    ],
  };

  return { chartType: 'hbar', option, title };
}

/** Pie chart for proportion/share, ordered largest-first. */
function buildPie(
  columns: string[],
  rows: (string | number | null)[][],
  catIdx: number,
  numIdx: number,
  question: string | undefined,
): BuiltChart {
  const data = sortByValueDesc(rows, numIdx)
    .slice(0, MAX_SERIES_ITEMS)
    .map((r) => ({ name: String(r[catIdx] ?? ''), value: toNum(r[numIdx]) ?? 0 }))
    .filter((d) => d.value > 0);

  const title = makeTitle(question, 'pie', columns[catIdx]);

  // Many slices make outer labels collide; fall back to a scrollable legend.
  const dense = data.length > 7;

  const option: Record<string, unknown> = {
    title: titleBlock(title),
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: {
      type: 'scroll',
      ...(dense
        ? { orient: 'vertical', right: 8, top: 'middle', itemGap: 10 }
        : { bottom: 8, itemGap: 16 }),
    },
    series: [
      {
        name: columns[numIdx],
        type: 'pie',
        radius: ['42%', '68%'],
        center: dense ? ['38%', '56%'] : ['50%', '54%'],
        avoidLabelOverlap: true,
        minAngle: 3,
        itemStyle: { borderRadius: 6 },
        label: dense
          ? { show: false }
          : { show: true, formatter: '{b}\n{d}%', fontSize: 11, lineHeight: 15 },
        labelLine: dense ? { show: false } : { length: 10, length2: 12, smooth: true },
        emphasis: { scale: true, scaleSize: 6 },
        data,
      },
    ],
  };

  return { chartType: 'pie', option, title };
}

/** Scatter chart for correlation between two numeric columns. */
function buildScatter(
  columns: string[],
  rows: (string | number | null)[][],
  xIdx: number,
  yIdx: number,
  question: string | undefined,
): BuiltChart {
  const data = rows
    .slice(0, 200)
    .map((r) => [toNum(r[xIdx]), toNum(r[yIdx])])
    .filter((p) => p[0] !== null && p[1] !== null);

  const title = makeTitle(question, 'scatter', `${columns[xIdx]} vs ${columns[yIdx]}`);

  const option: Record<string, unknown> = {
    title: titleBlock(title),
    tooltip: { trigger: 'item' },
    // Extra bottom room for the centred x-axis name.
    grid: { ...gridBlock(), bottom: 42 },
    xAxis: { type: 'value', name: columns[xIdx], nameLocation: 'middle', nameGap: 26, scale: true },
    yAxis: { type: 'value', name: columns[yIdx], scale: true },
    series: [
      {
        name: `${columns[xIdx]} / ${columns[yIdx]}`,
        type: 'scatter',
        symbolSize: 10,
        itemStyle: { opacity: 0.75 },
        emphasis: { focus: 'series', itemStyle: { opacity: 1 } },
        data,
      },
    ],
  };

  return { chartType: 'scatter', option, title };
}

/**
 * Validate that an LLM-generated option has the minimum required structure.
 * Returns true if it can be safely rendered.
 */
export function isValidChartOption(option: unknown): option is Record<string, unknown> {
  if (!option || typeof option !== 'object') return false;
  const opt = option as Record<string, unknown>;
  if (!Array.isArray(opt.series) || opt.series.length === 0) return false;
  const first = opt.series[0] as Record<string, unknown>;
  if (!first || typeof first !== 'object') return false;
  if (!first.type || !Array.isArray(first.data)) return false;
  return true;
}
