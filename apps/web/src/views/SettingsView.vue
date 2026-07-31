<script setup lang="ts">
import { computed, onMounted } from 'vue';
import AppShell from '@/components/layout/AppShell.vue';
import GlassSelect from '@/components/common/GlassSelect.vue';
import ModelCombobox from '@/components/common/ModelCombobox.vue';
import { Cpu, Key, Languages, Server, FileText, Brain, Table2, ArrowRight, Save } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import { setLocale, getLocale } from '@/locales';
import type { LocaleKey } from '@/locales';
import { useSettings } from '@/composables/useSettings';
import { LLM_PROVIDERS, getProvider } from '@/constants/llm-providers';

const { t } = useI18n();
const { form, saving, loadSettings, saveSettings, onProviderChange } = useSettings();

const localeOptions = computed(() => [
  { value: 'zh-CN', label: t('settings.chinese') },
  { value: 'en-US', label: t('settings.english') },
]);

const providerOptions = computed(() =>
  LLM_PROVIDERS.map((p) => ({ value: p.id, label: p.name })),
);

const modelSuggestions = computed(() => getProvider(form.value.provider)?.models ?? []);

function handleLocaleChange(value: string) {
  setLocale(value as LocaleKey);
}

onMounted(loadSettings);
</script>

<template>
  <AppShell>
    <div class="settings">
      <div class="settings__header">
        <h1 class="settings__title">{{ t('settings.title') }}</h1>
        <p class="settings__desc">{{ t('settings.desc') }}</p>
      </div>

      <div class="settings__sections">
        <section class="settings__section glass-panel">
          <div class="settings__section-header">
            <Languages :size="18" />
            <h2>{{ t('settings.language') }}</h2>
          </div>
          <div class="settings__field">
            <label class="settings__label">{{ t('settings.languageDesc') }}</label>
            <GlassSelect
              :model-value="getLocale()"
              :options="localeOptions"
              @update:model-value="handleLocaleChange"
            />
          </div>
        </section>

        <section class="settings__section glass-panel">
          <div class="settings__section-header">
            <Cpu :size="18" />
            <h2>{{ t('settings.llmProvider') }}</h2>
          </div>

          <div class="settings__field">
            <label class="settings__label">{{ t('settings.provider') }}</label>
            <GlassSelect
              :model-value="form.provider"
              :options="providerOptions"
              @update:model-value="onProviderChange"
            />
          </div>

          <div class="settings__field">
            <label class="settings__label">{{ t('settings.model') }}</label>
            <ModelCombobox
              v-model="form.model"
              :suggestions="modelSuggestions"
              :placeholder="t('settings.modelPlaceholder')"
            />
            <p class="settings__hint">{{ t('settings.modelHint') }}</p>
          </div>
        </section>

        <section class="settings__section glass-panel">
          <div class="settings__section-header">
            <Key :size="18" />
            <h2>{{ t('settings.apiConfig') }}</h2>
          </div>

          <div class="settings__field">
            <label class="settings__label">{{ t('settings.apiKey') }}</label>
            <input
              v-model="form.apiKey"
              class="settings__input glass-input"
              type="password"
              :placeholder="t('settings.apiKeyPlaceholder')"
              autocomplete="off"
            />
            <p class="settings__hint">{{ t('settings.apiKeyHint') }}</p>
          </div>

          <div class="settings__field">
            <label class="settings__label">{{ t('settings.baseUrl') }}</label>
            <input
              v-model="form.baseUrl"
              class="settings__input glass-input"
              type="text"
              placeholder="https://api.deepseek.com"
              spellcheck="false"
            />
          </div>

          <button class="settings__save" :disabled="saving" @click="saveSettings">
            <Save :size="16" />
            <span>{{ saving ? t('settings.saving') : t('settings.save') }}</span>
          </button>
        </section>

        <section class="settings__section glass-panel">
          <div class="settings__section-header">
            <Server :size="18" />
            <h2>{{ t('settings.privateDeploy') }}</h2>
          </div>
          <p class="settings__section-desc">{{ t('settings.privateDeployDesc') }}</p>

          <div class="settings__deploy-list">
            <a
              class="settings__deploy-item glass-panel--interactive"
              href="https://jitword.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span class="settings__deploy-icon">
                <FileText :size="18" />
              </span>
              <span class="settings__deploy-body">
                <span class="settings__deploy-name">jitword</span>
                <span class="settings__deploy-desc">{{ t('settings.jitwordDesc') }}</span>
              </span>
              <ArrowRight :size="16" class="settings__deploy-arrow" />
            </a>

            <a
              class="settings__deploy-item glass-panel--interactive"
              href="https://know.jitword.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span class="settings__deploy-icon">
                <Brain :size="18" />
              </span>
              <span class="settings__deploy-body">
                <span class="settings__deploy-name">jitknow</span>
                <span class="settings__deploy-desc">{{ t('settings.jitknowDesc') }}</span>
              </span>
              <ArrowRight :size="16" class="settings__deploy-arrow" />
            </a>

            <div class="settings__deploy-item settings__deploy-item--current">
              <span class="settings__deploy-icon">
                <Table2 :size="18" />
              </span>
              <span class="settings__deploy-body">
                <span class="settings__deploy-name">{{ t('settings.aurekaTable') }}</span>
                <span class="settings__deploy-desc">{{ t('settings.aurekaTableDesc') }}</span>
              </span>
              <span class="settings__deploy-badge">{{ t('settings.current') }}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  </AppShell>
</template>

<style scoped>
.settings {
  padding: var(--space-8);
  max-width: 640px;
  margin: 0 auto;
}

.settings__header {
  margin-bottom: var(--space-8);
}

.settings__title {
  font-size: var(--text-2xl);
  font-weight: 700;
  letter-spacing: -0.02em;
  margin-bottom: var(--space-2);
}

.settings__desc {
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
}

.settings__sections {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.settings__section {
  padding: var(--space-6);
  position: relative;
}

/*
 * backdrop-filter on each glass section creates a stacking context, which
 * would trap an open dropdown inside its own section and let the next
 * sibling paint over it. Raise the whole section while a dropdown inside
 * it is open so the menu layers above following sections.
 */
.settings__section:has(.gselect--open),
.settings__section:has(.mcombo__menu) {
  z-index: 100;
}

.settings__section-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-6);
  color: var(--color-text-secondary);
}

.settings__section-header h2 {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--color-text-primary);
}

.settings__section-desc {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  margin: calc(-1 * var(--space-4)) 0 var(--space-5);
}

.settings__field {
  margin-bottom: var(--space-4);
}

.settings__label {
  display: block;
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--color-text-secondary);
  margin-bottom: var(--space-2);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.settings__input {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-sm);
  color: var(--color-text-primary);
}

.settings__hint {
  margin-top: var(--space-2);
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  line-height: 1.5;
}

.settings__save {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-2);
  padding: var(--space-3) var(--space-5);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-bg-primary);
  background: var(--color-text-primary);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.settings__save:hover:not(:disabled) {
  opacity: 0.85;
}

.settings__save:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.settings__deploy-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.settings__deploy-item {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4);
  border-radius: var(--radius-md);
  background: var(--ov-03);
  border: 1px solid var(--ov-06);
  cursor: pointer;
  text-decoration: none;
}

.settings__deploy-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  background: var(--ov-06);
  border: 1px solid var(--ov-08);
  color: var(--color-text-primary);
  flex-shrink: 0;
}

.settings__deploy-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.settings__deploy-name {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text-primary);
}

.settings__deploy-desc {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.settings__deploy-arrow {
  color: var(--color-text-muted);
  flex-shrink: 0;
  transition: transform var(--duration-fast) var(--ease-out);
}

.settings__deploy-item:hover .settings__deploy-arrow {
  transform: translateX(3px);
  color: var(--color-text-primary);
}

.settings__deploy-item--current {
  cursor: default;
}

.settings__deploy-badge {
  flex-shrink: 0;
  padding: 2px 10px;
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-text-primary);
  border-radius: 999px;
  background: var(--ov-08);
  border: 1px solid var(--ov-12);
  letter-spacing: 0.02em;
}
</style>
