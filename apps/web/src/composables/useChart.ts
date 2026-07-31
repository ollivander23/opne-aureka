import { ref, onMounted, onUnmounted, type Ref } from 'vue';
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart, ScatterChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

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

const DARK_THEME: Record<string, unknown> = {
  backgroundColor: 'transparent',
  textStyle: { color: '#a3a3a3' },
  title: { textStyle: { color: '#ffffff' } },
  legend: { textStyle: { color: '#a3a3a3' } },
  tooltip: {
    backgroundColor: 'rgba(20, 20, 20, 0.9)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    textStyle: { color: '#ffffff' },
  },
  categoryAxis: {
    axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
    axisLabel: { color: '#737373' },
    splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
  },
  valueAxis: {
    axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
    axisLabel: { color: '#737373' },
    splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
  },
};

export function useChart(containerRef: Ref<HTMLElement | null>) {
  const chartInstance = ref<echarts.ECharts | null>(null);

  function initChart() {
    if (!containerRef.value) return;
    chartInstance.value = echarts.init(containerRef.value, undefined, {
      renderer: 'canvas',
    });
  }

  function setOption(option: Record<string, unknown>) {
    if (!chartInstance.value) initChart();
    chartInstance.value?.setOption({ ...DARK_THEME, ...option }, true);
  }

  function resize() {
    chartInstance.value?.resize();
  }

  function dispose() {
    chartInstance.value?.dispose();
    chartInstance.value = null;
  }

  onMounted(() => {
    window.addEventListener('resize', resize);
  });

  onUnmounted(() => {
    window.removeEventListener('resize', resize);
    dispose();
  });

  return { chartInstance, initChart, setOption, resize, dispose };
}
