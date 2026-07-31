import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * LLM provider abstraction over the OpenAI-compatible chat completion API.
 * Works with DeepSeek / OpenAI / Qwen / Kimi and any OpenAI-compatible gateway.
 * Uses native fetch + manual SSE parsing for full streaming control.
 * Config is resolved from runtime settings (Settings page), which override
 * the .env defaults.
 */
@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(private readonly settingsService: SettingsService) {}

  get provider(): string {
    return this.settingsService.getLlmConfig().provider;
  }

  get model(): string {
    return this.settingsService.getLlmConfig().model;
  }

  get baseUrl(): string {
    return this.settingsService.getLlmConfig().baseUrl;
  }

  get apiKey(): string {
    return this.settingsService.getLlmConfig().apiKey;
  }

  get temperature(): number {
    return this.settingsService.getLlmConfig().temperature;
  }

  get maxTokens(): number {
    return this.settingsService.getLlmConfig().maxTokens;
  }

  /** Whether a real API key is configured (not empty and not a placeholder). */
  get isConfigured(): boolean {
    const key = this.apiKey.trim();
    if (key.length === 0) return false;
    // Reject common placeholder patterns
    if (/your[-_]?api[-_]?key/i.test(key)) return false;
    if (/^sk-xxxx/i.test(key)) return false;
    if (/^change[-_]?this/i.test(key)) return false;
    return true;
  }

  /**
   * Stream a chat completion. Invokes onToken for each content delta.
   * Returns the full accumulated response text.
   */
  async streamChat(messages: ChatMessage[], onToken: (token: string) => void): Promise<string> {
    const url = `${this.baseUrl.replace(/\/$/, '')}/chat/completions`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: this.temperature,
        max_tokens: this.maxTokens,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      this.logger.error(`LLM API error ${response.status}: ${errText.slice(0, 300)}`);
      throw new Error(`LLM API error ${response.status}`);
    }

    if (!response.body) {
      throw new Error('LLM API returned an empty response body');
    }

    let full = '';
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === '[DONE]') continue;

          try {
            const json = JSON.parse(payload);
            const delta: string = json.choices?.[0]?.delta?.content ?? '';
            if (delta) {
              full += delta;
              onToken(delta);
            }
          } catch {
            // Ignore malformed SSE chunks
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return full;
  }
}
