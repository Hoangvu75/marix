/**
 * ThemeSelector Component Tests
 * Tests for theme selection and application
 */

describe('ThemeSelector Component', () => {
  describe('Theme List', () => {
    const themes = [
      'Atom One Dark',
      'Atom One Light',
      'Dracula',
      'Monokai',
      'Solarized Dark',
      'Solarized Light',
      'Nord',
      'Material',
      'GitHub Dark',
      'GitHub Light',
    ];

    it('should have multiple themes available', () => {
      expect(themes.length).toBeGreaterThan(5);
    });

    it('should have unique theme names', () => {
      const uniqueThemes = new Set(themes);
      expect(uniqueThemes.size).toBe(themes.length);
    });

    it('should have both dark and light themes', () => {
      const darkThemes = themes.filter(t => t.toLowerCase().includes('dark'));
      const lightThemes = themes.filter(t => t.toLowerCase().includes('light'));
      
      expect(darkThemes.length).toBeGreaterThan(0);
      expect(lightThemes.length).toBeGreaterThan(0);
    });
  });

  describe('Theme Detection', () => {
    const isDarkTheme = (themeName: string): boolean => {
      const darkKeywords = ['dark', 'night', 'dracula', 'monokai', 'nord', 'atom one dark'];
      const name = themeName.toLowerCase();
      return darkKeywords.some(keyword => name.includes(keyword));
    };

    it('should detect dark themes', () => {
      expect(isDarkTheme('Atom One Dark')).toBe(true);
      expect(isDarkTheme('Dracula')).toBe(true);
      expect(isDarkTheme('Nord')).toBe(true);
      expect(isDarkTheme('Night Owl')).toBe(true);
    });

    it('should detect light themes', () => {
      expect(isDarkTheme('Atom One Light')).toBe(false);
      expect(isDarkTheme('Solarized Light')).toBe(false);
    });
  });

  describe('Theme Parsing', () => {
    interface ThemeColors {
      background: string;
      foreground: string;
      cursor: string;
      selection: string;
      black: string;
      red: string;
      green: string;
      yellow: string;
      blue: string;
      magenta: string;
      cyan: string;
      white: string;
    }

    const parseTheme = (json: string): ThemeColors | null => {
      try {
        const parsed = JSON.parse(json);
        // Validate required fields
        if (!parsed.background || !parsed.foreground) {
          return null;
        }
        return parsed as ThemeColors;
      } catch {
        return null;
      }
    };

    it('should parse valid theme JSON', () => {
      const themeJson = JSON.stringify({
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#ffffff',
        selection: '#264f78',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
      });
      const theme = parseTheme(themeJson);
      expect(theme).not.toBeNull();
      expect(theme?.background).toBe('#1e1e1e');
    });

    it('should reject invalid JSON', () => {
      expect(parseTheme('not json')).toBeNull();
    });

    it('should reject theme without required fields', () => {
      const partial = JSON.stringify({ black: '#000000' });
      expect(parseTheme(partial)).toBeNull();
    });
  });

  describe('Theme Application', () => {
    let currentTheme = 'Atom One Dark';
    let appliedThemes: string[] = [];

    const applyTheme = (themeName: string) => {
      currentTheme = themeName;
      appliedThemes.push(themeName);
    };

    beforeEach(() => {
      currentTheme = 'Atom One Dark';
      appliedThemes = [];
    });

    it('should apply theme', () => {
      applyTheme('Dracula');
      expect(currentTheme).toBe('Dracula');
    });

    it('should track theme changes', () => {
      applyTheme('Dracula');
      applyTheme('Nord');
      applyTheme('Monokai');
      expect(appliedThemes).toEqual(['Dracula', 'Nord', 'Monokai']);
    });
  });

  describe('Theme Search', () => {
    const themes = [
      'Atom One Dark',
      'Atom One Light',
      'Dracula',
      'Monokai',
      'Solarized Dark',
      'Solarized Light',
      'Material Theme',
      'Material Palenight',
    ];

    const searchThemes = (query: string): string[] => {
      const lowerQuery = query.toLowerCase();
      return themes.filter(t => t.toLowerCase().includes(lowerQuery));
    };

    it('should find themes by name', () => {
      const results = searchThemes('atom');
      expect(results).toContain('Atom One Dark');
      expect(results).toContain('Atom One Light');
      expect(results.length).toBe(2);
    });

    it('should find themes by partial match', () => {
      const results = searchThemes('mat');
      expect(results).toContain('Material Theme');
      expect(results).toContain('Material Palenight');
    });

    it('should be case-insensitive', () => {
      const results1 = searchThemes('DRACULA');
      const results2 = searchThemes('dracula');
      expect(results1).toEqual(results2);
    });

    it('should return all on empty query', () => {
      const results = searchThemes('');
      expect(results.length).toBe(themes.length);
    });

    it('should return empty for no match', () => {
      const results = searchThemes('nonexistent');
      expect(results.length).toBe(0);
    });
  });

  describe('Theme Preview', () => {
    interface PreviewState {
      originalTheme: string | null;
      previewTheme: string | null;
      isPreviewActive: boolean;
    }

    let previewState: PreviewState = {
      originalTheme: null,
      previewTheme: null,
      isPreviewActive: false,
    };

    const startPreview = (currentTheme: string, newTheme: string) => {
      previewState = {
        originalTheme: currentTheme,
        previewTheme: newTheme,
        isPreviewActive: true,
      };
    };

    const cancelPreview = (): string | null => {
      const original = previewState.originalTheme;
      previewState = {
        originalTheme: null,
        previewTheme: null,
        isPreviewActive: false,
      };
      return original;
    };

    const confirmPreview = (): string | null => {
      const preview = previewState.previewTheme;
      previewState = {
        originalTheme: null,
        previewTheme: null,
        isPreviewActive: false,
      };
      return preview;
    };

    beforeEach(() => {
      previewState = {
        originalTheme: null,
        previewTheme: null,
        isPreviewActive: false,
      };
    });

    it('should start preview', () => {
      startPreview('Atom One Dark', 'Dracula');
      expect(previewState.isPreviewActive).toBe(true);
      expect(previewState.originalTheme).toBe('Atom One Dark');
      expect(previewState.previewTheme).toBe('Dracula');
    });

    it('should cancel preview and return original', () => {
      startPreview('Atom One Dark', 'Dracula');
      const original = cancelPreview();
      expect(original).toBe('Atom One Dark');
      expect(previewState.isPreviewActive).toBe(false);
    });

    it('should confirm preview and return new theme', () => {
      startPreview('Atom One Dark', 'Dracula');
      const confirmed = confirmPreview();
      expect(confirmed).toBe('Dracula');
      expect(previewState.isPreviewActive).toBe(false);
    });
  });

  describe('Theme Categories', () => {
    interface ThemeCategory {
      name: string;
      themes: string[];
    }

    const categories: ThemeCategory[] = [
      { name: 'Dark', themes: ['Atom One Dark', 'Dracula', 'Nord'] },
      { name: 'Light', themes: ['Atom One Light', 'Solarized Light'] },
      { name: 'High Contrast', themes: ['High Contrast', 'Black'] },
      { name: 'Popular', themes: ['Dracula', 'Monokai', 'Material'] },
    ];

    it('should have multiple categories', () => {
      expect(categories.length).toBeGreaterThan(2);
    });

    it('should have themes in each category', () => {
      categories.forEach(category => {
        expect(category.themes.length).toBeGreaterThan(0);
      });
    });

    const getThemesByCategory = (categoryName: string): string[] => {
      const category = categories.find(c => c.name === categoryName);
      return category?.themes || [];
    };

    it('should get themes by category', () => {
      const darkThemes = getThemesByCategory('Dark');
      expect(darkThemes).toContain('Dracula');
    });

    it('should return empty for unknown category', () => {
      const unknown = getThemesByCategory('Unknown');
      expect(unknown.length).toBe(0);
    });
  });

  describe('Color Validation', () => {
    const isValidHexColor = (color: string): boolean => {
      return /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/.test(color);
    };

    it('should validate 6-digit hex colors', () => {
      expect(isValidHexColor('#1e1e1e')).toBe(true);
      expect(isValidHexColor('#FFFFFF')).toBe(true);
      expect(isValidHexColor('#000000')).toBe(true);
    });

    it('should validate 3-digit hex colors', () => {
      expect(isValidHexColor('#fff')).toBe(true);
      expect(isValidHexColor('#000')).toBe(true);
    });

    it('should reject invalid colors', () => {
      expect(isValidHexColor('red')).toBe(false);
      expect(isValidHexColor('1e1e1e')).toBe(false);
      expect(isValidHexColor('#gggggg')).toBe(false);
    });
  });
});
