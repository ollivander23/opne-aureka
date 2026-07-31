import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

export interface LlmSettings {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl: string;
  temperature: number;
  maxTokens: number;
}

export interface AppSettings {
  llm: LlmSettings;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

/**
 * Runtime application settings persisted to data/settings.json.
 * Values configured here override the .env defaults, allowing users to
 * configure the LLM provider/key from the Settings page without touching
 * environment variables.
 */
@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);
  private settings: AppSettings;

  constructor(private readonly config: ConfigService) {
    this.settings = this.load();
  }

  /** Load persisted settings, falling back to .env defaults. */
  private load(): AppSettings {
    const defaults = this.fromEnv();

    try {
      if (fs.existsSync(SETTINGS_FILE)) {
        const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
        const parsed = JSON.parse(raw) as Partial<AppSettings>;
        const fileLlm: Partial<LlmSettings> = parsed.llm ?? {};

        // Filter out placeholder / empty apiKey from the file so that a
        // real key from .env is not overridden by a stale placeholder.
        if (this.isPlaceholder(fileLlm.apiKey)) {
          delete fileLlm.apiKey;
        }

        return {
          llm: { ...defaults.llm, ...fileLlm },
        };
      }
    } catch (err) {
      this.logger.warn(`Failed to load settings file, using defaults: ${(err as Error).message}`);
    }

    return defaults;
  }

  /** Build default settings from environment configuration. */
  private fromEnv(): AppSettings {
    return {
      llm: {
        provider: this.config.get<string>('llm.provider', 'deepseek'),
        model: this.config.get<string>('llm.model', 'deepseek-v4-pro'),
        apiKey: this.config.get<string>('llm.apiKey', ''),
        baseUrl: this.config.get<string>('llm.baseUrl', 'https://api.deepseek.com'),
        temperature: this.config.get<number>('llm.temperature', 0.1),
        maxTokens: this.config.get<number>('llm.maxTokens', 4096),
      },
    };
  }

  /** Persist current settings to disk. */
  private persist(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(this.settings, null, 2), 'utf-8');
    } catch (err) {
      this.logger.error(`Failed to persist settings: ${(err as Error).message}`);
    }
  }

  /** Effective LLM config for internal use (real API key). */
  getLlmConfig(): LlmSettings {
    return { ...this.settings.llm };
  }

  /** Public settings for the API (API key masked). */
  getPublicSettings(): AppSettings {
    return {
      llm: {
        ...this.settings.llm,
        apiKey: this.maskKey(this.settings.llm.apiKey),
      },
    };
  }

  /**
   * Update LLM settings. If the incoming apiKey is empty or the masked
   * placeholder, the existing key is preserved.
   */
  updateLlmSettings(patch: Partial<LlmSettings>): AppSettings {
    const incomingKey = patch.apiKey;
    const keepExistingKey =
      incomingKey === undefined || incomingKey === '' || this.isMasked(incomingKey);

    this.settings.llm = {
      ...this.settings.llm,
      ...patch,
      apiKey: keepExistingKey ? this.settings.llm.apiKey : (incomingKey as string),
    };

    this.persist();
    return this.getPublicSettings();
  }

  /** Mask an API key for safe display: keep first 3 and last 2 chars. */
  private maskKey(key: string): string {
    if (!key) return '';
    if (key.length <= 8) return '*'.repeat(key.length);
    return `${key.slice(0, 3)}${'*'.repeat(Math.min(key.length - 5, 24))}${key.slice(-2)}`;
  }

  /** Whether a value looks like one of our masked keys. */
  private isMasked(value: string): boolean {
    return /^\*+$/.test(value) || /^.{3}\*+.{2}$/.test(value);
  }

  /** Whether a value is a placeholder that should not override .env. */
  private isPlaceholder(value: string | undefined): boolean {
    if (!value) return true;
    const v = value.trim();
    return (
      v === '' ||
      /your[-_]?api[-_]?key/i.test(v) ||
      /^sk-xxxx/i.test(v) ||
      /^change[-_]?this/i.test(v)
    );
  }
}
