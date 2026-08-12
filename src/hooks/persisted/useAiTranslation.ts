import { useMMKVObject } from 'react-native-mmkv';
import { getMMKVObject, MMKVStorage } from '@utils/mmkv/mmkv';

export const AI_TRANSLATION_SETTINGS = 'AI_TRANSLATION_SETTINGS';

export type AiProviderId = 'gemini' | 'mistral' | 'groq' | 'openrouter';

export interface AiTranslationSettings {
  /** Master toggle for online reading */
  enableForReading: boolean;
  /** Master toggle for chapter downloads */
  enableForDownload: boolean;
  /** Target language for translation */
  targetLanguage: string;
  /**
   * Ordered provider IDs — first entry is tried first, then the next on
   * failure, until the list is exhausted.
   */
  providerOrder: AiProviderId[];
  /** Per-provider API keys, keyed by provider id */
  apiKeys: Record<AiProviderId, string>;
  /**
   * Extra delay in ms inserted between translation requests during bulk
   * chapter downloads, on top of the normal chapter download cooldown.
   */
  downloadTranslationDelayMs: number;
}

export const ALL_PROVIDERS: AiProviderId[] = [
  'gemini',
  'mistral',
  'groq',
  'openrouter',
];

export const PROVIDER_LABELS: Record<AiProviderId, string> = {
  gemini: 'Google Gemini',
  mistral: 'Mistral AI',
  groq: 'Groq',
  openrouter: 'OpenRouter',
};

const initialAiTranslationSettings: AiTranslationSettings = {
  enableForReading: false,
  enableForDownload: false,
  targetLanguage: 'Arabic',
  providerOrder: ['gemini', 'mistral', 'groq', 'openrouter'],
  apiKeys: {
    gemini: '',
    mistral: '',
    groq: '',
    openrouter: '',
  },
  downloadTranslationDelayMs: 4000,
};

/**
 * React hook — subscribes to MMKV changes. Use inside components/hooks.
 */
export const useAiTranslationSettings = () => {
  const [stored = initialAiTranslationSettings, setStored] =
    useMMKVObject<AiTranslationSettings>(AI_TRANSLATION_SETTINGS);

  // Merge with defaults so new fields added in future versions are always present.
  const settings: AiTranslationSettings = {
    ...initialAiTranslationSettings,
    ...stored,
    apiKeys: {
      ...initialAiTranslationSettings.apiKeys,
      ...stored.apiKeys,
    },
  };

  const setAiTranslationSettings = (values: Partial<AiTranslationSettings>) =>
    setStored({ ...settings, ...values });

  return {
    ...settings,
    setAiTranslationSettings,
  };
};

/**
 * Non-reactive getter — safe to call from background services and headless
 * task runners (same pattern as `getChapterDownloadCooldownMs`).
 */
export const getAiTranslationSettings = (): AiTranslationSettings => {
  const stored = getMMKVObject<AiTranslationSettings>(AI_TRANSLATION_SETTINGS);
  return {
    ...initialAiTranslationSettings,
    ...stored,
    apiKeys: {
      ...initialAiTranslationSettings.apiKeys,
      ...stored?.apiKeys,
    },
  };
};

/**
 * Clear all cached translations stored by the translation service.
 * Scans all MMKV keys and removes those with the translation-cache prefix.
 */
export const clearAllTranslationCache = (): void => {
  const prefix = 'TRANSLATION_CACHE_';
  const keys = MMKVStorage.getAllKeys();
  for (const key of keys) {
    if (key.startsWith(prefix)) {
      MMKVStorage.remove(key);
    }
  }
};
