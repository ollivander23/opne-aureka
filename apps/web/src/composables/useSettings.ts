import { ref } from 'vue';
import { api as ofetch } from '@/utils/http';
import { useUIStore } from '@/stores/ui';
import { i18n } from '@/locales';
import { getProvider } from '@/constants/llm-providers';

const { t } = i18n.global;

export interface LlmSettingsForm {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl: string;
  temperature: number;
  maxTokens: number;
}

export function useSettings() {
  const uiStore = useUIStore();
  const form = ref<LlmSettingsForm>({
    provider: 'deepseek',
    model: 'deepseek-chat',
    apiKey: '',
    baseUrl: 'https://api.deepseek.com',
    temperature: 0.1,
    maxTokens: 4096,
  });
  const loading = ref(false);
  const saving = ref(false);

  async function loadSettings() {
    loading.value = true;
    try {
      const result = await ofetch<{ llm: LlmSettingsForm }>('/api/settings');
      if (result?.llm) {
        form.value = { ...form.value, ...result.llm };
      }
    } catch {
      uiStore.addToast({ type: 'error', message: t('settings.loadFailed') });
    } finally {
      loading.value = false;
    }
  }

  async function saveSettings() {
    saving.value = true;
    try {
      const result = await ofetch<{ llm: LlmSettingsForm }>('/api/settings', {
        method: 'PUT',
        body: { llm: form.value },
      });
      if (result?.llm) {
        form.value = { ...form.value, ...result.llm };
      }
      uiStore.addToast({ type: 'success', message: t('settings.saved') });
    } catch {
      uiStore.addToast({ type: 'error', message: t('settings.saveFailed') });
    } finally {
      saving.value = false;
    }
  }

  /** When provider changes, auto-fill its default base URL and model. */
  function onProviderChange(providerId: string) {
    form.value.provider = providerId;
    const provider = getProvider(providerId);
    if (provider) {
      form.value.baseUrl = provider.baseUrl;
      form.value.model = provider.defaultModel;
    }
  }

  return { form, loading, saving, loadSettings, saveSettings, onProviderChange };
}
