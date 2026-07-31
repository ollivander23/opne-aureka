/**
 * LLM provider catalog with known model lists and default endpoints.
 * Model lists reference each vendor's publicly documented offerings.
 */
export interface LlmProvider {
  id: string;
  name: string;
  baseUrl: string;
  defaultModel: string;
  models: string[];
}

export const LLM_PROVIDERS: LlmProvider[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-v4-pro',
    models: ['deepseek-v4-pro', 'deepseek-v4-flash'],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o1', 'o1-mini'],
  },
  {
    id: 'qwen',
    name: 'Qwen (通义千问)',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-plus',
    models: ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen-long', 'qwen2.5-72b-instruct'],
  },
  {
    id: 'kimi',
    name: 'Kimi (月之暗面)',
    baseUrl: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-8k',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
  },
];

export function getProvider(id: string): LlmProvider | undefined {
  return LLM_PROVIDERS.find((p) => p.id === id);
}
