import { storage } from './storage.js';

const KEY = 'trailing.theme';
export const getTheme = () => storage.get(KEY) || 'system';

/** 'system' follows the OS; 'light' / 'dark' override it. */
export function setTheme(theme) {
  if (theme === 'light' || theme === 'dark') {
    document.documentElement.dataset.theme = theme;
    storage.set(KEY, theme);
  } else {
    delete document.documentElement.dataset.theme;
    storage.remove(KEY);
  }
}
