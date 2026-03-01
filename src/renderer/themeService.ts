import { ITheme } from '@xterm/xterm';

// Only two supported themes: Dracula (dark) and Light (light mode)

export const DRACULA_THEME: ITheme = {
  background: '#282a36',
  foreground: '#f8f8f2',
  cursor: '#f8f8f2',
  cursorAccent: '#282a36',
  selectionBackground: '#44475a',
  black: '#21222c',
  red: '#ff5555',
  green: '#50fa7b',
  yellow: '#f1fa8c',
  blue: '#bd93f9',
  magenta: '#ff79c6',
  cyan: '#8be9fd',
  white: '#f8f8f2',
  brightBlack: '#6272a4',
  brightRed: '#ff6e6e',
  brightGreen: '#69ff94',
  brightYellow: '#ffffa5',
  brightBlue: '#d6acff',
  brightMagenta: '#ff92df',
  brightCyan: '#a4ffff',
  brightWhite: '#ffffff',
};

export const LIGHT_THEME: ITheme = {
  background: '#f5f5f5',
  foreground: '#1e1e1e',
  cursor: '#1e1e1e',
  cursorAccent: '#f5f5f5',
  selectionBackground: '#b4d5fe',
  black: '#2e2e2e',
  red: '#c41a16',
  green: '#0e7d0e',
  yellow: '#b58900',
  blue: '#268bd2',
  magenta: '#d33682',
  cyan: '#2aa198',
  white: '#4e4e4e',
  brightBlack: '#6e6e6e',
  brightRed: '#c41a16',
  brightGreen: '#0e7d0e',
  brightYellow: '#b58900',
  brightBlue: '#268bd2',
  brightMagenta: '#d33682',
  brightCyan: '#2aa198',
  brightWhite: '#1e1e1e',
};

const THEMES: Record<string, ITheme> = {
  'Dracula': DRACULA_THEME,
  'Light': LIGHT_THEME,
};

/**
 * Get theme by name. Returns Dracula for any unknown name.
 */
export async function getTheme(name: string): Promise<ITheme> {
  return THEMES[name] ?? DRACULA_THEME;
}

/**
 * Get theme synchronously. Returns Dracula for any unknown name.
 */
export function getThemeSync(name: string): ITheme {
  return THEMES[name] ?? DRACULA_THEME;
}

/**
 * No-op, kept for API compat.
 */
export async function preloadTheme(_name: string): Promise<void> {
  // no-op: all themes are inline
}

// Legacy compat exports
export interface ThemeInfo { name: string; }

export async function getThemeList(): Promise<string[]> {
  return Object.keys(THEMES);
}

export async function getAllThemes(): Promise<ThemeInfo[]> {
  return Object.keys(THEMES).map(name => ({ name }));
}

export async function initThemeService(): Promise<void> {
  // no-op
}
