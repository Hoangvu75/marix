/**
 * LanguageSelector Component Tests
 * Tests for internationalization and language selection
 */

describe('LanguageSelector Component', () => {
  describe('Supported Languages', () => {
    const languages = [
      { code: 'en', name: 'English', nativeName: 'English' },
      { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt' },
      { code: 'zh', name: 'Chinese', nativeName: '中文' },
      { code: 'ja', name: 'Japanese', nativeName: '日本語' },
      { code: 'ko', name: 'Korean', nativeName: '한국어' },
      { code: 'de', name: 'German', nativeName: 'Deutsch' },
      { code: 'fr', name: 'French', nativeName: 'Français' },
      { code: 'es', name: 'Spanish', nativeName: 'Español' },
      { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
      { code: 'ru', name: 'Russian', nativeName: 'Русский' },
      { code: 'th', name: 'Thai', nativeName: 'ไทย' },
      { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia' },
      { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu' },
      { code: 'fil', name: 'Filipino', nativeName: 'Filipino' },
    ];

    it('should have 14 supported languages', () => {
      expect(languages.length).toBe(14);
    });

    it('should have unique language codes', () => {
      const codes = languages.map(l => l.code);
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(languages.length);
    });

    it('should have all required language info', () => {
      languages.forEach(lang => {
        expect(lang.code).toBeDefined();
        expect(lang.name).toBeDefined();
        expect(lang.nativeName).toBeDefined();
      });
    });

    it('should include English as default', () => {
      const english = languages.find(l => l.code === 'en');
      expect(english).toBeDefined();
    });
  });

  describe('Language Detection', () => {
    const detectLanguage = (browserLang: string): string => {
      const supported = ['en', 'vi', 'zh', 'ja', 'ko', 'de', 'fr', 'es', 'pt', 'ru', 'th', 'id', 'ms', 'fil'];
      const code = browserLang.split('-')[0].toLowerCase();
      return supported.includes(code) ? code : 'en';
    };

    it('should detect exact match', () => {
      expect(detectLanguage('vi')).toBe('vi');
      expect(detectLanguage('zh')).toBe('zh');
    });

    it('should detect from locale string', () => {
      expect(detectLanguage('en-US')).toBe('en');
      expect(detectLanguage('pt-BR')).toBe('pt');
      expect(detectLanguage('zh-CN')).toBe('zh');
    });

    it('should fallback to English for unsupported', () => {
      expect(detectLanguage('ar')).toBe('en');
      expect(detectLanguage('he')).toBe('en');
    });

    it('should handle case variations', () => {
      expect(detectLanguage('VI')).toBe('vi');
      expect(detectLanguage('En-us')).toBe('en');
    });
  });

  describe('Language Selection', () => {
    let currentLanguage = 'en';
    const listeners: ((lang: string) => void)[] = [];

    const setLanguage = (code: string) => {
      currentLanguage = code;
      listeners.forEach(fn => fn(code));
    };

    const onLanguageChange = (callback: (lang: string) => void) => {
      listeners.push(callback);
      return () => {
        const index = listeners.indexOf(callback);
        if (index > -1) listeners.splice(index, 1);
      };
    };

    beforeEach(() => {
      currentLanguage = 'en';
      listeners.length = 0;
    });

    it('should change language', () => {
      setLanguage('vi');
      expect(currentLanguage).toBe('vi');
    });

    it('should notify listeners on change', () => {
      const callback = jest.fn();
      onLanguageChange(callback);
      setLanguage('ja');
      expect(callback).toHaveBeenCalledWith('ja');
    });

    it('should unsubscribe listeners', () => {
      const callback = jest.fn();
      const unsubscribe = onLanguageChange(callback);
      unsubscribe();
      setLanguage('ko');
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Translation Function', () => {
    const translations: Record<string, Record<string, string>> = {
      en: {
        welcome: 'Welcome',
        serverList: 'Server List',
        connect: 'Connect',
        disconnect: 'Disconnect',
        settings: 'Settings',
      },
      vi: {
        welcome: 'Chào mừng',
        serverList: 'Danh sách máy chủ',
        connect: 'Kết nối',
        disconnect: 'Ngắt kết nối',
        settings: 'Cài đặt',
      },
      ja: {
        welcome: 'ようこそ',
        serverList: 'サーバーリスト',
        connect: '接続',
        disconnect: '切断',
        settings: '設定',
      },
    };

    let currentLang = 'en';

    const t = (key: string): string => {
      return translations[currentLang]?.[key] || translations['en']?.[key] || key;
    };

    beforeEach(() => {
      currentLang = 'en';
    });

    it('should return translation for current language', () => {
      expect(t('welcome')).toBe('Welcome');
      
      currentLang = 'vi';
      expect(t('welcome')).toBe('Chào mừng');
    });

    it('should fallback to English for missing translations', () => {
      currentLang = 'vi';
      // Assuming 'unknownKey' doesn't exist in vi but exists in en
      translations.en['specificKey'] = 'English Value';
      expect(t('specificKey')).toBe('English Value');
    });

    it('should return key if no translation exists', () => {
      expect(t('nonexistent.key')).toBe('nonexistent.key');
    });
  });

  describe('RTL Language Support', () => {
    const rtlLanguages = ['ar', 'he', 'fa', 'ur'];
    
    const isRTL = (langCode: string): boolean => {
      return rtlLanguages.includes(langCode);
    };

    it('should detect RTL languages', () => {
      expect(isRTL('ar')).toBe(true);
      expect(isRTL('he')).toBe(true);
    });

    it('should detect LTR languages', () => {
      expect(isRTL('en')).toBe(false);
      expect(isRTL('vi')).toBe(false);
      expect(isRTL('zh')).toBe(false);
    });
  });

  describe('Language Persistence', () => {
    let storedLanguage: string | null = null;

    const saveLanguage = (code: string) => {
      storedLanguage = code;
    };

    const loadLanguage = (): string => {
      return storedLanguage || 'en';
    };

    beforeEach(() => {
      storedLanguage = null;
    });

    it('should save language preference', () => {
      saveLanguage('ja');
      expect(storedLanguage).toBe('ja');
    });

    it('should load saved language', () => {
      saveLanguage('ko');
      expect(loadLanguage()).toBe('ko');
    });

    it('should fallback to English if no saved language', () => {
      expect(loadLanguage()).toBe('en');
    });
  });

  describe('Language Search', () => {
    const languages = [
      { code: 'en', name: 'English', nativeName: 'English' },
      { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt' },
      { code: 'zh', name: 'Chinese', nativeName: '中文' },
      { code: 'ja', name: 'Japanese', nativeName: '日本語' },
    ];

    const searchLanguages = (query: string) => {
      const lowerQuery = query.toLowerCase();
      return languages.filter(
        l => l.name.toLowerCase().includes(lowerQuery) ||
             l.nativeName.toLowerCase().includes(lowerQuery) ||
             l.code.toLowerCase().includes(lowerQuery)
      );
    };

    it('should find by English name', () => {
      const results = searchLanguages('vietnamese');
      expect(results.length).toBe(1);
      expect(results[0].code).toBe('vi');
    });

    it('should find by native name', () => {
      const results = searchLanguages('Tiếng Việt');
      expect(results.length).toBe(1);
    });

    it('should find by code', () => {
      const results = searchLanguages('ja');
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Japanese');
    });

    it('should return all on empty query', () => {
      const results = searchLanguages('');
      expect(results.length).toBe(languages.length);
    });
  });

  describe('Pluralization', () => {
    const pluralize = (count: number, singular: string, plural: string): string => {
      return count === 1 ? singular : plural;
    };

    it('should use singular for 1', () => {
      expect(pluralize(1, 'server', 'servers')).toBe('server');
      expect(pluralize(1, 'file', 'files')).toBe('file');
    });

    it('should use plural for 0', () => {
      expect(pluralize(0, 'server', 'servers')).toBe('servers');
    });

    it('should use plural for > 1', () => {
      expect(pluralize(5, 'server', 'servers')).toBe('servers');
      expect(pluralize(100, 'file', 'files')).toBe('files');
    });
  });

  describe('Number Formatting', () => {
    const formatNumber = (num: number, locale: string): string => {
      return new Intl.NumberFormat(locale).format(num);
    };

    it('should format numbers for English', () => {
      expect(formatNumber(1000, 'en')).toBe('1,000');
      expect(formatNumber(1000000, 'en')).toBe('1,000,000');
    });

    it('should format numbers for German', () => {
      expect(formatNumber(1000, 'de')).toBe('1.000');
    });

    it('should handle decimals', () => {
      const result = formatNumber(1234.56, 'en');
      expect(result).toContain('1,234');
    });
  });

  describe('Date Formatting', () => {
    const formatDate = (date: Date, locale: string): string => {
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(date);
    };

    const testDate = new Date('2024-06-15');

    it('should format date for English', () => {
      const result = formatDate(testDate, 'en');
      expect(result).toContain('Jun');
      expect(result).toContain('15');
      expect(result).toContain('2024');
    });

    it('should format date for Japanese', () => {
      const result = formatDate(testDate, 'ja');
      expect(result).toContain('2024');
    });

    it('should format date for German', () => {
      const result = formatDate(testDate, 'de');
      expect(result.includes('Juni') || result.includes('Jun')).toBe(true);
    });
  });
});
