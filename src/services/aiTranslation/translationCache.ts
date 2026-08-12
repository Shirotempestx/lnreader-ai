import { MMKVStorage } from '@utils/mmkv/mmkv';

const PREFIX = 'TRANSLATION_CACHE_';

/**
 * Read a cached translated HTML string for a chapter.
 * Returns `undefined` when no cache entry exists.
 */
export const getTranslationCache = (chapterId: number): string | undefined => {
  const raw = MMKVStorage.getString(`${PREFIX}${chapterId}`);
  return raw ?? undefined;
};

/**
 * Write a translated HTML string for a chapter into the MMKV cache.
 */
export const setTranslationCache = (chapterId: number, html: string): void => {
  MMKVStorage.set(`${PREFIX}${chapterId}`, html);
};

/**
 * Delete the cached translation for a specific chapter.
 */
export const deleteTranslationCache = (chapterId: number): void => {
  MMKVStorage.remove(`${PREFIX}${chapterId}`);
};
