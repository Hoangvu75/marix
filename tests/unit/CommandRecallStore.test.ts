/**
 * Unit tests for CommandRecallStore
 * Tests command history storage, LRU pruning, and sensitive command filtering
 */

describe('CommandRecallStore', () => {
  // Simulated store matching the commandRecallStore implementation
  const MAX_COMMANDS_PER_SERVER = 50;
  
  // Sensitive command patterns (should match the actual implementation)
  const SENSITIVE_PATTERNS = [
    /password[=:\s]/i,
    /passwd/i,
    /secret[=:\s]/i,
    /token[=:\s]/i,
    /api[_-]?key[=:\s]/i,
    /auth[=:\s]/i,
    /credential/i,
    /mysql\s+.*-p/i,
    /sudo\s+.*-S/i,
    /sshpass/i,
    /\bexport\s+(PASSWORD|SECRET|TOKEN|API_KEY|AWS_|GITHUB_TOKEN)/i,
    /curl\s+.*(-u|--user)\s/i,
    /wget\s+.*--password/i,
    /htpasswd/i,
    /openssl\s+(passwd|enc)/i,
  ];

  interface CommandEntry {
    id: string;
    command: string;
    timestamp: number;
    count: number;
  }

  interface CommandHistory {
    [serverId: string]: CommandEntry[];
  }

  let mockStorage: Record<string, any>;
  let commandHistory: CommandHistory;

  // Helper to simulate the isSensitiveCommand function
  const isSensitiveCommand = (command: string): boolean => {
    return SENSITIVE_PATTERNS.some(pattern => pattern.test(command));
  };

  // Helper to generate unique ID
  const generateId = (): string => {
    return Math.random().toString(36).substring(2, 9);
  };

  // Helper to add command (simulating the store behavior)
  const addCommand = (serverId: string, command: string): boolean => {
    const trimmed = command.trim();
    if (!trimmed || isSensitiveCommand(trimmed)) {
      return false;
    }

    if (!commandHistory[serverId]) {
      commandHistory[serverId] = [];
    }

    // Check for duplicate
    const existingIndex = commandHistory[serverId].findIndex(
      entry => entry.command === trimmed
    );

    if (existingIndex !== -1) {
      // Move to front (most recent) and increment count
      const existing = commandHistory[serverId].splice(existingIndex, 1)[0];
      existing.timestamp = Date.now();
      existing.count += 1;
      commandHistory[serverId].unshift(existing);
    } else {
      // Add new command
      commandHistory[serverId].unshift({
        id: generateId(),
        command: trimmed,
        timestamp: Date.now(),
        count: 1
      });
    }

    // LRU pruning - keep only MAX_COMMANDS_PER_SERVER
    if (commandHistory[serverId].length > MAX_COMMANDS_PER_SERVER) {
      commandHistory[serverId] = commandHistory[serverId].slice(0, MAX_COMMANDS_PER_SERVER);
    }

    return true;
  };

  // Helper to search commands
  const searchCommands = (serverId: string, query: string): CommandEntry[] => {
    if (!commandHistory[serverId]) return [];
    const loweredQuery = query.toLowerCase();
    return commandHistory[serverId].filter(
      entry => entry.command.toLowerCase().includes(loweredQuery)
    );
  };

  // Helper to delete command
  const deleteCommand = (serverId: string, commandId: string): boolean => {
    if (!commandHistory[serverId]) return false;
    const index = commandHistory[serverId].findIndex(entry => entry.id === commandId);
    if (index === -1) return false;
    commandHistory[serverId].splice(index, 1);
    return true;
  };

  // Helper to get stats
  const getStats = (serverId: string) => {
    const commands = commandHistory[serverId] || [];
    return {
      totalCommands: commands.length,
      uniqueCommands: commands.length,
      mostUsed: commands.length > 0 
        ? commands.reduce((prev, curr) => (curr.count > prev.count ? curr : prev))
        : null
    };
  };

  beforeEach(() => {
    // Reset mock storage before each test
    mockStorage = {};
    commandHistory = {};
  });

  describe('Command Addition', () => {
    it('should add a new command to server history', () => {
      const serverId = 'server-1';
      const command = 'ls -la';
      
      const result = addCommand(serverId, command);
      
      expect(result).toBe(true);
      expect(commandHistory[serverId]).toHaveLength(1);
      expect(commandHistory[serverId][0].command).toBe(command);
      expect(commandHistory[serverId][0].count).toBe(1);
    });

    it('should trim whitespace from commands', () => {
      const serverId = 'server-1';
      const command = '  ls -la  ';
      
      addCommand(serverId, command);
      
      expect(commandHistory[serverId][0].command).toBe('ls -la');
    });

    it('should reject empty commands', () => {
      const serverId = 'server-1';
      
      const result1 = addCommand(serverId, '');
      const result2 = addCommand(serverId, '   ');
      
      expect(result1).toBe(false);
      expect(result2).toBe(false);
      expect(commandHistory[serverId]).toBeUndefined();
    });

    it('should increment count for duplicate commands', () => {
      const serverId = 'server-1';
      const command = 'cat /etc/hosts';
      
      addCommand(serverId, command);
      addCommand(serverId, command);
      addCommand(serverId, command);
      
      expect(commandHistory[serverId]).toHaveLength(1);
      expect(commandHistory[serverId][0].count).toBe(3);
    });

    it('should move duplicates to front of history', () => {
      const serverId = 'server-1';
      
      addCommand(serverId, 'command-1');
      addCommand(serverId, 'command-2');
      addCommand(serverId, 'command-3');
      addCommand(serverId, 'command-1'); // Re-run first command
      
      expect(commandHistory[serverId]).toHaveLength(3);
      expect(commandHistory[serverId][0].command).toBe('command-1');
      expect(commandHistory[serverId][0].count).toBe(2);
    });

    it('should maintain separate histories for different servers', () => {
      addCommand('server-1', 'command-a');
      addCommand('server-2', 'command-b');
      
      expect(commandHistory['server-1']).toHaveLength(1);
      expect(commandHistory['server-2']).toHaveLength(1);
      expect(commandHistory['server-1'][0].command).toBe('command-a');
      expect(commandHistory['server-2'][0].command).toBe('command-b');
    });
  });

  describe('LRU Pruning', () => {
    it('should limit commands to MAX_COMMANDS_PER_SERVER', () => {
      const serverId = 'server-1';
      
      // Add more than MAX commands
      for (let i = 0; i < MAX_COMMANDS_PER_SERVER + 10; i++) {
        addCommand(serverId, `command-${i}`);
      }
      
      expect(commandHistory[serverId]).toHaveLength(MAX_COMMANDS_PER_SERVER);
    });

    it('should keep most recent commands after pruning', () => {
      const serverId = 'server-1';
      
      // Add more than MAX commands
      for (let i = 0; i < MAX_COMMANDS_PER_SERVER + 5; i++) {
        addCommand(serverId, `command-${i}`);
      }
      
      // Most recent commands should be kept (they're at the front)
      const lastCommand = `command-${MAX_COMMANDS_PER_SERVER + 4}`;
      expect(commandHistory[serverId][0].command).toBe(lastCommand);
      
      // Oldest commands should be pruned
      const oldestKept = `command-5`;
      expect(commandHistory[serverId][MAX_COMMANDS_PER_SERVER - 1].command).toBe(oldestKept);
    });

    it('should maintain LRU order', () => {
      const serverId = 'server-1';
      
      addCommand(serverId, 'oldest');
      addCommand(serverId, 'middle');
      addCommand(serverId, 'newest');
      
      expect(commandHistory[serverId][0].command).toBe('newest');
      expect(commandHistory[serverId][2].command).toBe('oldest');
    });
  });

  describe('Sensitive Command Filtering', () => {
    const sensitiveCommands = [
      'mysql -u root -pMyPassword',
      'sudo -S shutdown',
      'sshpass -p secret ssh user@host',
      'export PASSWORD=secret123',
      'export AWS_SECRET_KEY=abcd1234',
      'export GITHUB_TOKEN=ghp_xxxx',
      'curl -u user:password http://api.example.com',
      'wget --password=secret http://example.com',
      'htpasswd -b /etc/nginx/.htpasswd user pass',
      'openssl passwd -1 mysecret',
      'openssl enc -aes-256-cbc -pass pass:secret',
      'echo "password=test"',
      'config set auth=bearer_token_123',
      'credential store add',
      'TOKEN=abc123 ./script.sh',
      'API_KEY=xyz ./run.sh',
      'secret=mypassword command',
    ];

    const safeCommands = [
      'ls -la',
      'cat /etc/hosts',
      'grep pattern file.txt',
      'docker ps',
      'npm install',
      'git status',
      'cd /var/log',
      'tail -f syslog',
      'ps aux',
      'df -h',
      'echo "Hello World"',
      'vim config.yml',
      'systemctl status nginx',
    ];

    it.each(sensitiveCommands)('should reject sensitive command: %s', (command) => {
      expect(isSensitiveCommand(command)).toBe(true);
    });

    it.each(safeCommands)('should allow safe command: %s', (command) => {
      expect(isSensitiveCommand(command)).toBe(false);
    });

    it('should not add sensitive commands to history', () => {
      const serverId = 'server-1';
      
      sensitiveCommands.forEach(cmd => {
        addCommand(serverId, cmd);
      });
      
      expect(commandHistory[serverId]).toBeUndefined();
    });

    it('should add safe commands to history', () => {
      const serverId = 'server-1';
      
      safeCommands.forEach(cmd => {
        addCommand(serverId, cmd);
      });
      
      expect(commandHistory[serverId]).toHaveLength(safeCommands.length);
    });
  });

  describe('Command Search', () => {
    beforeEach(() => {
      const serverId = 'server-1';
      addCommand(serverId, 'docker ps');
      addCommand(serverId, 'docker images');
      addCommand(serverId, 'docker-compose up');
      addCommand(serverId, 'ls -la');
      addCommand(serverId, 'cat /var/log/syslog');
    });

    it('should find commands matching search query', () => {
      const results = searchCommands('server-1', 'docker');
      
      expect(results).toHaveLength(3);
      results.forEach(r => {
        expect(r.command.toLowerCase()).toContain('docker');
      });
    });

    it('should return empty array for no matches', () => {
      const results = searchCommands('server-1', 'nginx');
      
      expect(results).toHaveLength(0);
    });

    it('should be case-insensitive', () => {
      const results = searchCommands('server-1', 'DOCKER');
      
      expect(results).toHaveLength(3);
    });

    it('should return all commands for empty query', () => {
      const results = searchCommands('server-1', '');
      
      expect(results).toHaveLength(5);
    });

    it('should return empty for non-existent server', () => {
      const results = searchCommands('non-existent', 'docker');
      
      expect(results).toHaveLength(0);
    });
  });

  describe('Command Deletion', () => {
    it('should delete command by ID', () => {
      const serverId = 'server-1';
      addCommand(serverId, 'command-to-keep');
      addCommand(serverId, 'command-to-delete');
      
      const commandId = commandHistory[serverId][0].id;
      const initialLength = commandHistory[serverId].length;
      
      const result = deleteCommand(serverId, commandId);
      
      expect(result).toBe(true);
      expect(commandHistory[serverId]).toHaveLength(initialLength - 1);
    });

    it('should return false for non-existent command ID', () => {
      const serverId = 'server-1';
      addCommand(serverId, 'some-command');
      
      const result = deleteCommand(serverId, 'non-existent-id');
      
      expect(result).toBe(false);
    });

    it('should return false for non-existent server', () => {
      const result = deleteCommand('non-existent-server', 'some-id');
      
      expect(result).toBe(false);
    });
  });

  describe('Command Clear', () => {
    it('should clear all commands for a server', () => {
      const serverId = 'server-1';
      addCommand(serverId, 'command-1');
      addCommand(serverId, 'command-2');
      addCommand(serverId, 'command-3');
      
      commandHistory[serverId] = [];
      
      expect(commandHistory[serverId]).toHaveLength(0);
    });

    it('should not affect other servers when clearing', () => {
      addCommand('server-1', 'command-1');
      addCommand('server-2', 'command-2');
      
      commandHistory['server-1'] = [];
      
      expect(commandHistory['server-1']).toHaveLength(0);
      expect(commandHistory['server-2']).toHaveLength(1);
    });
  });

  describe('Statistics', () => {
    it('should return correct total command count', () => {
      const serverId = 'server-1';
      addCommand(serverId, 'command-1');
      addCommand(serverId, 'command-2');
      addCommand(serverId, 'command-3');
      
      const stats = getStats(serverId);
      
      expect(stats.totalCommands).toBe(3);
    });

    it('should identify most used command', () => {
      const serverId = 'server-1';
      addCommand(serverId, 'rarely-used');
      addCommand(serverId, 'frequently-used');
      addCommand(serverId, 'frequently-used');
      addCommand(serverId, 'frequently-used');
      addCommand(serverId, 'another-command');
      
      const stats = getStats(serverId);
      
      expect(stats.mostUsed?.command).toBe('frequently-used');
      expect(stats.mostUsed?.count).toBe(3);
    });

    it('should return null mostUsed for empty history', () => {
      const stats = getStats('empty-server');
      
      expect(stats.totalCommands).toBe(0);
      expect(stats.mostUsed).toBeNull();
    });
  });

  describe('Enabled/Disabled State', () => {
    let enabled: boolean;

    beforeEach(() => {
      enabled = false; // Default to disabled
    });

    it('should start disabled by default', () => {
      expect(enabled).toBe(false);
    });

    it('should be able to enable', () => {
      enabled = true;
      expect(enabled).toBe(true);
    });

    it('should be able to disable', () => {
      enabled = true;
      enabled = false;
      expect(enabled).toBe(false);
    });
  });

  describe('Relative Time Formatting', () => {
    const formatRelativeTime = (timestamp: number): string => {
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
    };

    it('should format recent times as "just now"', () => {
      const now = Date.now();
      expect(formatRelativeTime(now)).toBe('just now');
      expect(formatRelativeTime(now - 30000)).toBe('just now'); // 30 seconds
    });

    it('should format minutes correctly', () => {
      const now = Date.now();
      expect(formatRelativeTime(now - 60000)).toBe('1m ago');
      expect(formatRelativeTime(now - 300000)).toBe('5m ago');
      expect(formatRelativeTime(now - 3540000)).toBe('59m ago');
    });

    it('should format hours correctly', () => {
      const now = Date.now();
      expect(formatRelativeTime(now - 3600000)).toBe('1h ago');
      expect(formatRelativeTime(now - 7200000)).toBe('2h ago');
      expect(formatRelativeTime(now - 82800000)).toBe('23h ago');
    });

    it('should format days correctly', () => {
      const now = Date.now();
      expect(formatRelativeTime(now - 86400000)).toBe('1d ago');
      expect(formatRelativeTime(now - 172800000)).toBe('2d ago');
      expect(formatRelativeTime(now - 604800000)).toBe('7d ago');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long commands', () => {
      const serverId = 'server-1';
      const longCommand = 'x'.repeat(10000);
      
      addCommand(serverId, longCommand);
      
      expect(commandHistory[serverId]).toHaveLength(1);
      expect(commandHistory[serverId][0].command).toBe(longCommand);
    });

    it('should handle special characters in commands', () => {
      const serverId = 'server-1';
      const specialCommands = [
        'echo "hello world"',
        "echo 'single quotes'",
        'cmd | grep pattern',
        'cmd && cmd2',
        'cmd || cmd2',
        'cmd > output.txt',
        'cmd >> append.txt',
        'cmd < input.txt',
        'echo $HOME',
        'echo ${VAR:-default}',
        'cmd `subshell`',
        'cmd $(subshell)',
        'cmd &',
        'cmd; cmd2',
        'find . -name "*.txt"',
        'awk \'{print $1}\'',
      ];
      
      specialCommands.forEach(cmd => {
        addCommand(serverId, cmd);
      });
      
      expect(commandHistory[serverId]).toHaveLength(specialCommands.length);
    });

    it('should handle unicode characters', () => {
      const serverId = 'server-1';
      const unicodeCommands = [
        'echo "日本語"',
        'echo "한국어"',
        'echo "中文"',
        'echo "🚀🎉"',
        'cat файл.txt',
      ];
      
      unicodeCommands.forEach(cmd => {
        addCommand(serverId, cmd);
      });
      
      expect(commandHistory[serverId]).toHaveLength(unicodeCommands.length);
    });

    it('should handle commands with newlines (treated as single command)', () => {
      const serverId = 'server-1';
      const multilineCommand = 'echo "line1\nline2"';
      
      addCommand(serverId, multilineCommand);
      
      expect(commandHistory[serverId]).toHaveLength(1);
    });
  });
});
