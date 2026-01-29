// Type definitions for window.electron exposed by preload.ts
// This ensures type safety when using contextIsolation: true

interface ElectronIpcRenderer {
  invoke(channel: string, ...args: any[]): Promise<any>;
  send(channel: string, ...args: any[]): void;
  on(channel: string, func: (...args: any[]) => void): void;
  removeListener(channel: string, func: (...args: any[]) => void): void;
  removeAllListeners(channel: string): void;
}

interface ElectronShell {
  openExternal(url: string): Promise<void>;
}

interface ElectronAPI {
  ipcRenderer: ElectronIpcRenderer;
  shell: ElectronShell;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}

export {};export {};
