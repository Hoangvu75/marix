/**
 * App Settings Store
 * 
 * Persistent storage for application settings using electron-store
 */

import Store from 'electron-store';
import * as crypto from 'crypto';

// Lock method types
export type LockMethod = 'none' | 'blur' | 'pin' | 'password';

interface AppSettings {
  sessionMonitorEnabled: boolean;
  terminalFont: string;
  terminalFontSize: number;
  // App Lock settings
  appLockEnabled: boolean;
  appLockMethod: LockMethod;
  appLockTimeout: number; // minutes
  appLockHash: string; // hashed PIN or password
  // Add more settings here as needed
}

const defaults: AppSettings = {
  sessionMonitorEnabled: true,
  terminalFont: 'JetBrains Mono',
  terminalFontSize: 14,
  appLockEnabled: false,
  appLockMethod: 'blur',
  appLockTimeout: 5,
  appLockHash: '',
};

class AppSettingsStore {
  private store: any;

  constructor() {
    this.store = new Store({
      name: 'app-settings',
      defaults,
    });
  }

  get<K extends keyof AppSettings>(key: K): AppSettings[K] {
    return this.store.get(key);
  }

  set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    this.store.set(key, value);
  }

  getAll(): AppSettings {
    return this.store.store;
  }

  // Hash PIN or password using SHA-256
  hashCredential(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  // Verify PIN or password
  verifyCredential(value: string): boolean {
    const storedHash = this.get('appLockHash');
    if (!storedHash) return true;
    return this.hashCredential(value) === storedHash;
  }

  // Set PIN or password (store as hash)
  setCredential(value: string): void {
    this.set('appLockHash', this.hashCredential(value));
  }

  // Clear credential
  clearCredential(): void {
    this.set('appLockHash', '');
  }
}

export const appSettings = new AppSettingsStore();
