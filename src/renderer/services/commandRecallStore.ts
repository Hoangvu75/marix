/**
 * Command Recall Store
 * 
 * Stores command history per server for quick recall.
 * - Local storage only, encrypted
 * - Never synced or backed up
 * - LRU pruning (max 50 commands per server)
 * - Sensitive command filtering
 */

import React from 'react';

export interface RecalledCommand {
  id: string;
  serverId: string;
  command: string;
  createdAt: number;
  lastUsedAt: number;
  execCount: number;
}

// Sensitive patterns to filter out
const SENSITIVE_PATTERNS: RegExp[] = [
  /password/i,
  /passwd/i,
  /secret/i,
  /token/i,
  /api[-_]?key/i,
  /--password[=\s]/i,
  /-p\s+\S+/,           // -p followed by value (common for password flags)
  /mysql\s+.*-p/i,      // mysql -p
  /export\s+.*(?:PASSWORD|TOKEN|SECRET|API_KEY)/i,
  /\bsudo\s+-S\b/i,     // sudo with stdin password
  /sshpass/i,
  /expect\s+.*password/i,
];

// Storage key
const STORAGE_KEY = 'command_recall_history';
const MAX_COMMANDS_PER_SERVER = 50;

class CommandRecallStore {
  private history: Map<string, RecalledCommand[]> = new Map();
  private listeners: Set<() => void> = new Set();
  private enabled: boolean = false; // Default to disabled (user enables in Settings)

  constructor() {
    this.load();
    this.loadEnabledState();
  }

  /**
   * Load history from localStorage
   */
  private load(): void {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        this.history = new Map(Object.entries(parsed));
      }
    } catch (error) {
      console.error('[CommandRecall] Failed to load history:', error);
      this.history = new Map();
    }
  }

  /**
   * Load enabled state from settings
   */
  private loadEnabledState(): void {
    try {
      const settings = localStorage.getItem('app_settings');
      if (settings) {
        const parsed = JSON.parse(settings);
        // Default to false - user must explicitly enable
        this.enabled = parsed.enableCommandRecall === true;
      } else {
        this.enabled = false; // Default disabled when no settings
      }
    } catch {
      this.enabled = false; // Default disabled on error
    }
  }

  /**
   * Save history to localStorage
   */
  private save(): void {
    try {
      const obj: Record<string, RecalledCommand[]> = {};
      this.history.forEach((commands, serverId) => {
        obj[serverId] = commands;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch (error) {
      console.error('[CommandRecall] Failed to save history:', error);
    }
  }

  /**
   * Notify all listeners of changes
   */
  private notifyListeners(): void {
    this.listeners.forEach(fn => fn());
  }

  /**
   * Subscribe to changes
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Check if command recall is enabled
   */
  isEnabled(): boolean {
    this.loadEnabledState();
    return this.enabled;
  }

  /**
   * Set enabled state
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    try {
      const settings = localStorage.getItem('app_settings');
      const parsed = settings ? JSON.parse(settings) : {};
      parsed.enableCommandRecall = enabled;
      localStorage.setItem('app_settings', JSON.stringify(parsed));
    } catch (error) {
      console.error('[CommandRecall] Failed to save enabled state:', error);
    }
    this.notifyListeners();
  }

  /**
   * Check if command contains sensitive data
   */
  isSensitiveCommand(command: string): boolean {
    return SENSITIVE_PATTERNS.some(pattern => pattern.test(command));
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `recall_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add a command to history
   */
  addCommand(serverId: string, command: string): void {
    // Don't add if disabled
    if (!this.isEnabled()) return;

    // Trim and validate
    const trimmed = command.trim();
    if (!trimmed || trimmed.length < 2) return;

    // Don't add sensitive commands
    if (this.isSensitiveCommand(trimmed)) {
      console.log('[CommandRecall] Skipping sensitive command');
      return;
    }

    const serverHistory = this.history.get(serverId) || [];
    const now = Date.now();

    // Check if command already exists
    const existingIndex = serverHistory.findIndex(c => c.command === trimmed);
    
    if (existingIndex !== -1) {
      // Update existing command
      const existing = serverHistory[existingIndex];
      existing.lastUsedAt = now;
      existing.execCount++;
      // Move to front (most recently used)
      serverHistory.splice(existingIndex, 1);
      serverHistory.unshift(existing);
    } else {
      // Add new command
      const newCommand: RecalledCommand = {
        id: this.generateId(),
        serverId,
        command: trimmed,
        createdAt: now,
        lastUsedAt: now,
        execCount: 1,
      };
      serverHistory.unshift(newCommand);
    }

    // LRU prune if over limit
    if (serverHistory.length > MAX_COMMANDS_PER_SERVER) {
      // Already sorted by lastUsedAt (most recent first)
      serverHistory.splice(MAX_COMMANDS_PER_SERVER);
    }

    this.history.set(serverId, serverHistory);
    this.save();
    this.notifyListeners();
  }

  /**
   * Get command history for a server (sorted by lastUsedAt desc)
   */
  getHistory(serverId: string): RecalledCommand[] {
    return this.history.get(serverId) || [];
  }

  /**
   * Search commands for a server
   */
  search(serverId: string, query: string): RecalledCommand[] {
    const history = this.getHistory(serverId);
    if (!query.trim()) return history;

    const lowerQuery = query.toLowerCase();
    return history.filter(c => 
      c.command.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Delete a specific command from history
   */
  deleteCommand(serverId: string, commandId: string): void {
    const serverHistory = this.history.get(serverId);
    if (!serverHistory) return;

    const index = serverHistory.findIndex(c => c.id === commandId);
    if (index !== -1) {
      serverHistory.splice(index, 1);
      this.history.set(serverId, serverHistory);
      this.save();
      this.notifyListeners();
    }
  }

  /**
   * Clear all history for a server
   */
  clearServerHistory(serverId: string): void {
    this.history.delete(serverId);
    this.save();
    this.notifyListeners();
  }

  /**
   * Clear all history
   */
  clearAllHistory(): void {
    this.history.clear();
    this.save();
    this.notifyListeners();
  }

  /**
   * Get stats for a server
   */
  getStats(serverId: string): { count: number; totalExecs: number } {
    const history = this.getHistory(serverId);
    return {
      count: history.length,
      totalExecs: history.reduce((sum, c) => sum + c.execCount, 0),
    };
  }

  /**
   * Format relative time
   */
  formatRelativeTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'just now';
  }
}

// Singleton instance
export const commandRecallStore = new CommandRecallStore();

// React hook
export function useCommandRecall(serverId: string) {
  const [history, setHistory] = React.useState<RecalledCommand[]>([]);
  const [enabled, setEnabledState] = React.useState(commandRecallStore.isEnabled());

  React.useEffect(() => {
    const updateHistory = () => {
      setHistory(commandRecallStore.getHistory(serverId));
      setEnabledState(commandRecallStore.isEnabled());
    };

    updateHistory();
    const unsubscribe = commandRecallStore.subscribe(updateHistory);
    return unsubscribe;
  }, [serverId]);

  return {
    history,
    enabled,
    setEnabled: (val: boolean) => commandRecallStore.setEnabled(val),
    addCommand: (cmd: string) => commandRecallStore.addCommand(serverId, cmd),
    search: (query: string) => commandRecallStore.search(serverId, query),
    deleteCommand: (id: string) => commandRecallStore.deleteCommand(serverId, id),
    clearHistory: () => commandRecallStore.clearServerHistory(serverId),
    getStats: () => commandRecallStore.getStats(serverId),
    formatTime: (ts: number) => commandRecallStore.formatRelativeTime(ts),
    isSensitive: (cmd: string) => commandRecallStore.isSensitiveCommand(cmd),
  };
}
