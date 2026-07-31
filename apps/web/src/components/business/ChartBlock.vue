<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted } from 'vue';
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart, ScatterChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { useUIStore } from '@/stores/ui';

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  ScatterChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  CanvasRenderer,
]);

/**
 * Series palettes. Tuned per theme so bars/lines stay vivid on black and
 * readable on white, while matching the product's cool, technical look.
 */
const PALETTE_DARK = [
  '#7DA8FF', '#6EE7B7', '#A78BFA', '#FBBF24', '#67E8F9',
  '#F472B6', '#FB923C', '#4ADE80', '#94A3B8',
];
const PALETTE_LIGHT = [
  '#3B72F0', '#0EA97A', '#7C4DE0', '#E0930A', '#0891B2',
  '#DB2777', '#EA6A0C', '#16A34A', '#64748B',
];

/**
 * Build a real ECharts *theme* object (not an option). Theme-level keys such as
 * `color`, `categoryAxis` and `valueAxis` are ONLY honoured when registered as a
 * theme — passing them through `setOption` silently does nothing, and merging a
 * pseudo-theme into the option also lets chart-specific `title`/`tooltip`/`legend`
 * blocks wipe out the styling. Registering a theme keeps our styling as the base
 * layer while each chart's own option stays on top.
 */
function buildTheme(isDark: boolean) {
  const text = isDark ? '#a3a3a3' : '#525252';
  const titleText = isDark ? '#ededed' : '#1f1f1f';
  const axisLine = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)';
  const splitLine = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const axis = {
    axisLine: { show: true, lineStyle: { color: axisLine } },
    axisTick: { show: false },
    axisLabel: { color: text, fontSize: 11 },
    splitLine: { show: true, lineStyle: { color: splitLine, type: 'dashed' } },
    splitArea: { show: false },
    nameTextStyle: { color: isDark ? '#8a8a8a' : '#6b6b6b', fontSize: 11 },
  };

  return {
    color: isDark ? PALETTE_DARK : PALETTE_LIGHT,
    backgroundColor: 'transparent',
    textStyle: { color: text, fontSize: 12 },
    title: {
      textStyle: { color: titleText, fontSize: 13, fontWeight: 600 },
      subtextStyle: { color: text, fontSize: 11 },
    },
    legend: {
      textStyle: { color: text, fontSize: 11 },
      itemWidth: 10,
      itemHeight: 10,
      icon: 'roundRect',
    },
    tooltip: {
      backgroundColor: isDark ? 'rgba(24,24,26,0.94)' : 'rgba(255,255,255,0.97)',
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
      borderWidth: 1,
      textStyle: { color: isDark ? '#f5f5f5' : '#171717', fontSize: 12 },
      axisPointer: {
        lineStyle: { color: axisLine },
        crossStyle: { color: axisLine },
        shadowStyle: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' },
      },
    },
    categoryAxis: axis,
    valueAxis: axis,
    line: {
      itemStyle: { borderWidth: 2 },
      lineStyle: { width: 2 },
      symbol: 'circle',
      symbolSize: 6,
      smooth: true,
    },
    bar: {
      itemStyle: { barBorderRadius: [3, 3, 0, 0] },
      // Value labels sit OUTSIDE the bar, so they must read against the
      // canvas background rather than inherit the (often dim) series color.
      label: { color: isDark ? '#d4d4d4' : '#404040' },
    },
    pie: {
      itemStyle: {
        borderColor: isDark ? 'rgba(0,0,0,0.35)' : '#ffffff',
        borderWidth: 2,
      },
      label: { color: text },
    },
  };
}

echarts.registerTheme('aureka-dark', buildTheme(true));
echarts.registerTheme('aureka-light', buildTheme(false));

const props = defineProps<{
  option: Record<string, unknown>;
}>();

const uiStore = useUIStore();
const chartRef = ref<HTMLElement | null>(null);
let instance: echarts.ECharts | null = null;

function themeName() {
  return uiStore.theme === 'dark' ? 'aureka-dark' : 'aureka-light';
}

/**
 * Server-built options stay theme-agnostic, so value labels carry no color.
 * ECharts defaults those to the series color ('inherit'), which makes labels
 * sitting OUTSIDE a bar/slice blend into the canvas. Inject the readable
 * theme color here, where the active theme is known.
 */
function themedOption(option: Record<string, unknown>): Record<string, unknown> {
  const series = option.series;
  if (!Array.isArray(series)) return option;

  const labelColor = uiStore.theme === 'dark' ? '#d4d4d4' : '#404040';

  return {
    ...option,
    series: series.map((s: any) => {
      const label = s?.label;
      if (!label || typeof label !== 'object' || label.show === false || label.color) return s;
      return { ...s, label: { ...label, color: labelColor } };
    }),
  };
}

function renderChart() {
  if (!chartRef.value) return;
  if (!instance) {
    instance = echarts.init(chartRef.value, themeName(), { renderer: 'canvas' });
  }
  instance.setOption(themedOption(props.option), true);
}

/** A theme can only be bound at init time, so flip it by recreating the chart. */
function rebuildForTheme() {
  instance?.dispose();
  instance = null;
  renderChart();
}

function handleResize() {
  instance?.resize();
}

onMounted(() => {
  renderChart();
  window.addEventListener('resize', handleResize);
});

watch(() => props.option, renderChart, { deep: true });
watch(() => uiStore.theme, rebuildForTheme);

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  instance?.dispose();
  instance = null;
});
</script>

<template>
  <div class="chart-block">
    <div ref="chartRef" class="chart-block__canvas" />
  </div>
</template>

<style scoped>
.chart-block {
  width: 100%;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-chart-bg);
  overflow: hidden;
}

.chart-block__canvas {
  width: 100%;
  height: 320px;
}
</style>
