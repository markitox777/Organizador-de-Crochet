
import type { Pattern } from '../types/pattern';

const STORAGE_KEY = 'kurotex_patterns';

export function getPatterns(): Pattern[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) return [];

    const parsed: unknown = JSON.parse(saved);

    return Array.isArray(parsed)
      ? parsed as Pattern[]
      : [];
  } catch {
    return [];
  }
}

export function savePatterns(patterns: Pattern[]): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(patterns)
  );
}
