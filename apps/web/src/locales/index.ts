import { createI18n } from 'vue-i18n';
import zhCN from './zh-CN';
import enUS from './en-US';

export type LocaleKey = 'zh-CN' | 'en-US';

const STORAGE_KEY = 'aureka_locale';

function getDefaultLocale(): LocaleKey {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'zh-CN' || stored === 'en-US') return stored;
  const nav = navigator.language;
  return nav.startsWith('zh') ? 'zh-CN' : 'en-US';
}

export const i18n = createI18n({
  legacy: false,
  locale: getDefaultLocale(),
  fallbackLocale: 'en-US',
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS,
  },
});

export function setLocale(locale: LocaleKey) {
  (i18n.global.locale as unknown as { value: string }).value = locale;
  localStorage.setItem(STORAGE_KEY, locale);
  document.documentElement.lang = locale === 'zh-CN' ? 'zh' : 'en';
}

export function getLocale(): LocaleKey {
  return i18n.global.locale.value as LocaleKey;
}
