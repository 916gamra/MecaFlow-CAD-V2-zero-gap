import { ZeroGapState } from '../types';

const STORAGE_KEY = 'mecaflow_config';

export function saveConfigToStorage(config: ZeroGapState): boolean {
  try {
    const serialized = JSON.stringify(config);
    localStorage.setItem(STORAGE_KEY, serialized);
    return true;
  } catch (error) {
    console.error('Failed to save config:', error);
    return false;
  }
}

export function loadConfigFromStorage(): ZeroGapState | null {
  try {
    const serialized = localStorage.getItem(STORAGE_KEY);
    if (!serialized) return null;
    return JSON.parse(serialized) as ZeroGapState;
  } catch (error) {
    console.error('Failed to load config:', error);
    return null;
  }
}

export function clearStoredConfig(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear config:', error);
  }
}