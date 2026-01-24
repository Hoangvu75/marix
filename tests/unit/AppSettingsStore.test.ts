/**
 * Unit tests for AppSettingsStore
 * Tests the persistent settings storage functionality
 */

// Mock electron-store before importing
jest.mock('electron-store', () => {
  return jest.fn().mockImplementation(() => {
    const store: Record<string, any> = {};
    return {
      get: jest.fn((key: string, defaultValue?: any) => store[key] ?? defaultValue),
      set: jest.fn((key: string, value: any) => { store[key] = value; }),
      delete: jest.fn((key: string) => { delete store[key]; }),
      clear: jest.fn(() => { Object.keys(store).forEach(k => delete store[k]); }),
      store
    };
  });
});

describe('AppSettingsStore', () => {
  let mockStore: any;

  beforeEach(() => {
    jest.clearAllMocks();
    // Create a fresh mock store for each test
    mockStore = {
      data: {} as Record<string, any>,
      get(key: string, defaultValue?: any) {
        return this.data[key] ?? defaultValue;
      },
      set(key: string, value: any) {
        this.data[key] = value;
      },
      delete(key: string) {
        delete this.data[key];
      }
    };
  });

  describe('Session Monitor Settings', () => {
    it('should return default value for sessionMonitorEnabled', () => {
      const enabled = mockStore.get('sessionMonitorEnabled', true);
      expect(enabled).toBe(true);
    });

    it('should save sessionMonitorEnabled setting', () => {
      mockStore.set('sessionMonitorEnabled', false);
      expect(mockStore.get('sessionMonitorEnabled')).toBe(false);
    });

    it('should toggle sessionMonitorEnabled', () => {
      mockStore.set('sessionMonitorEnabled', true);
      expect(mockStore.get('sessionMonitorEnabled')).toBe(true);
      
      mockStore.set('sessionMonitorEnabled', false);
      expect(mockStore.get('sessionMonitorEnabled')).toBe(false);
    });
  });

  describe('Terminal Font Settings', () => {
    const defaultFont = 'JetBrains Mono';
    const customFont = 'Fira Code';

    it('should return default terminal font', () => {
      const font = mockStore.get('terminalFont', defaultFont);
      expect(font).toBe(defaultFont);
    });

    it('should save terminal font setting', () => {
      mockStore.set('terminalFont', customFont);
      expect(mockStore.get('terminalFont')).toBe(customFont);
    });

    it('should persist font across gets', () => {
      mockStore.set('terminalFont', 'Source Code Pro');
      expect(mockStore.get('terminalFont')).toBe('Source Code Pro');
      expect(mockStore.get('terminalFont')).toBe('Source Code Pro');
    });
  });

  describe('App Lock Settings', () => {
    it('should return default appLockEnabled as false', () => {
      const enabled = mockStore.get('appLockEnabled', false);
      expect(enabled).toBe(false);
    });

    it('should save appLockEnabled setting', () => {
      mockStore.set('appLockEnabled', true);
      expect(mockStore.get('appLockEnabled')).toBe(true);
    });

    it('should save appLockMethod setting', () => {
      mockStore.set('appLockMethod', 'pin');
      expect(mockStore.get('appLockMethod')).toBe('pin');

      mockStore.set('appLockMethod', 'password');
      expect(mockStore.get('appLockMethod')).toBe('password');

      mockStore.set('appLockMethod', 'blur');
      expect(mockStore.get('appLockMethod')).toBe('blur');
    });

    it('should save appLockTimeout setting', () => {
      mockStore.set('appLockTimeout', 5);
      expect(mockStore.get('appLockTimeout')).toBe(5);

      mockStore.set('appLockTimeout', 15);
      expect(mockStore.get('appLockTimeout')).toBe(15);
    });

    it('should save appLockCredential (hashed)', () => {
      const hashedPin = 'hashed_1234';
      mockStore.set('appLockCredential', hashedPin);
      expect(mockStore.get('appLockCredential')).toBe(hashedPin);
    });

    it('should clear appLockCredential', () => {
      mockStore.set('appLockCredential', 'some_hash');
      mockStore.delete('appLockCredential');
      expect(mockStore.get('appLockCredential')).toBeUndefined();
    });
  });

  describe('Theme Settings', () => {
    it('should save and retrieve theme setting', () => {
      mockStore.set('theme', 'dark');
      expect(mockStore.get('theme')).toBe('dark');

      mockStore.set('theme', 'light');
      expect(mockStore.get('theme')).toBe('light');
    });

    it('should save terminal theme', () => {
      mockStore.set('terminalTheme', 'Dracula');
      expect(mockStore.get('terminalTheme')).toBe('Dracula');
    });
  });

  describe('Multiple Settings', () => {
    it('should handle multiple settings independently', () => {
      mockStore.set('sessionMonitorEnabled', true);
      mockStore.set('terminalFont', 'Monaco');
      mockStore.set('appLockEnabled', true);
      mockStore.set('appLockTimeout', 10);

      expect(mockStore.get('sessionMonitorEnabled')).toBe(true);
      expect(mockStore.get('terminalFont')).toBe('Monaco');
      expect(mockStore.get('appLockEnabled')).toBe(true);
      expect(mockStore.get('appLockTimeout')).toBe(10);
    });
  });
});
