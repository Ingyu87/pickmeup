import type { PersistedAppState } from './types';

const KEY = 'pickmeup:v1';

export function storageAvailable(): boolean {
  try {
    const t = '__pickmeup_probe__';
    localStorage.setItem(t, '1');
    localStorage.removeItem(t);
    return true;
  } catch {
    return false;
  }
}

function isValidState(data: unknown): data is PersistedAppState {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return d.version === 1 && typeof d.session === 'object' && d.session !== null;
}

export function loadState(): PersistedAppState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data: unknown = JSON.parse(raw);
    return isValidState(data) ? data : null;
  } catch {
    return null;
  }
}

export type SaveOutcome = 'saved' | 'quota' | 'unavailable';

export function saveState(state: PersistedAppState): SaveOutcome {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return 'saved';
  } catch (e) {
    if (
      e instanceof DOMException &&
      (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')
    ) {
      return 'quota';
    }
    return 'unavailable';
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable — nothing to clear */
  }
}

export function exportStateFile(state: PersistedAppState): void {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `픽미업-${state.session.className || '우리반'}-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseImportedState(text: string): PersistedAppState | null {
  try {
    const data: unknown = JSON.parse(text);
    return isValidState(data) ? data : null;
  } catch {
    return null;
  }
}
