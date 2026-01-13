const fs = require('fs');
const path = require('path');

const themesDir = path.join(__dirname, '../theme');
const outputFile = path.join(__dirname, '../src/renderer/themes.ts');

function convertVSCodeThemeToXterm(vscodeTheme) {
  const colors = vscodeTheme['workbench.colorCustomizations'] || {};
  
  return {
    background: colors['terminal.background'] || '#000000',
    foreground: colors['terminal.foreground'] || '#ffffff',
    cursor: colors['terminalCursor.foreground'] || colors['terminal.foreground'] || '#ffffff',
    cursorAccent: colors['terminalCursor.background'] || colors['terminal.background'] || '#000000',
    selectionBackground: colors['terminal.selectionBackground'] || 'rgba(255, 255, 255, 0.2)',
    selectionForeground: colors['terminal.selectionForeground'],
    black: colors['terminal.ansiBlack'] || '#000000',
    red: colors['terminal.ansiRed'] || '#cd3131',
    green: colors['terminal.ansiGreen'] || '#0dbc79',
    yellow: colors['terminal.ansiYellow'] || '#e5e510',
    blue: colors['terminal.ansiBlue'] || '#2472c8',
    magenta: colors['terminal.ansiMagenta'] || '#bc3fbc',
    cyan: colors['terminal.ansiCyan'] || '#11a8cd',
    white: colors['terminal.ansiWhite'] || '#e5e5e5',
    brightBlack: colors['terminal.ansiBrightBlack'] || '#666666',
    brightRed: colors['terminal.ansiBrightRed'] || '#f14c4c',
    brightGreen: colors['terminal.ansiBrightGreen'] || '#23d18b',
    brightYellow: colors['terminal.ansiBrightYellow'] || '#f5f543',
    brightBlue: colors['terminal.ansiBrightBlue'] || '#3b8eea',
    brightMagenta: colors['terminal.ansiBrightMagenta'] || '#d670d6',
    brightCyan: colors['terminal.ansiBrightCyan'] || '#29b8db',
    brightWhite: colors['terminal.ansiBrightWhite'] || '#e5e5e5',
  };
}

// Read all JSON files from theme directory
const themeFiles = fs.readdirSync(themesDir)
  .filter(file => file.endsWith('.json'))
  .sort();

const themes = [];

console.log(`Found ${themeFiles.length} theme files...`);

for (const file of themeFiles) {
  try {
    const filePath = path.join(themesDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const vscodeTheme = JSON.parse(content);
    
    const themeName = file.replace('.json', '');
    const xtermTheme = convertVSCodeThemeToXterm(vscodeTheme);
    
    themes.push({
      name: themeName,
      theme: xtermTheme
    });
    
    console.log(`✓ Converted: ${themeName}`);
  } catch (error) {
    console.error(`✗ Failed to convert ${file}:`, error.message);
  }
}

// Generate TypeScript file
const tsContent = `import { ITheme } from '@xterm/xterm';

export interface TerminalTheme {
  name: string;
  theme: ITheme;
}

export const terminalThemes: TerminalTheme[] = ${JSON.stringify(themes, null, 2)};

export const getThemeByName = (name: string): ITheme => {
  const theme = terminalThemes.find(t => t.name === name);
  return theme ? theme.theme : terminalThemes[0].theme;
};
`;

fs.writeFileSync(outputFile, tsContent);
console.log(`\n✓ Generated ${outputFile} with ${themes.length} themes!`);
