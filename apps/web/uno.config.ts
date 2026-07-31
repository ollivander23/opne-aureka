import { defineConfig, presetUno, presetAttributify } from 'unocss';
import transformerDirectives from '@unocss/transformer-directives';

export default defineConfig({
  presets: [presetUno(), presetAttributify()],
  transformers: [transformerDirectives()],
  theme: {
    colors: {
      bg: {
        primary: '#000000',
        secondary: '#0A0A0A',
        tertiary: '#111111',
      },
      surface: {
        DEFAULT: '#1A1A1A',
        hover: '#262626',
      },
      border: {
        DEFAULT: 'rgba(255, 255, 255, 0.06)',
        hover: 'rgba(255, 255, 255, 0.12)',
      },
      text: {
        primary: '#FFFFFF',
        secondary: '#A3A3A3',
        muted: '#737373',
      },
      accent: 'rgba(255, 255, 255, 0.08)',
    },
    fontFamily: {
      sans: "'Inter', 'Noto Sans SC', system-ui, sans-serif",
      mono: "'JetBrains Mono', monospace",
    },
    borderRadius: {
      sm: '8px',
      md: '12px',
      lg: '16px',
      xl: '20px',
    },
  },
  shortcuts: {
    'glass-panel':
      'bg-white/3 backdrop-blur-xl backdrop-saturate-150 border border-white/6 rounded-lg',
    'glass-panel-hover':
      'glass-panel hover:bg-white/6 hover:border-white/12 transition-all duration-250',
  },
});
