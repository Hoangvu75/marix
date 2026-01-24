/**
 * Unit tests for Backup Service
 * Tests backup creation, restoration, and encryption
 */

describe('BackupService', () => {
  interface BackupData {
    version: string;
    timestamp: number;
    servers: any[];
    settings: Record<string, any>;
    checksum: string;
  }

  class MockBackupService {
    private readonly BACKUP_VERSION = '1.0';

    generateChecksum(data: string): string {
      // Simple mock checksum (in real app, use crypto)
      let hash = 0;
      for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return Math.abs(hash).toString(16);
    }

    async createBackup(servers: any[], settings: Record<string, any>): Promise<BackupData> {
      const data = JSON.stringify({ servers, settings });
      const checksum = this.generateChecksum(data);
      
      return {
        version: this.BACKUP_VERSION,
        timestamp: Date.now(),
        servers,
        settings,
        checksum
      };
    }

    async validateBackup(backup: BackupData): Promise<{ valid: boolean; error?: string }> {
      // Check version
      if (!backup.version) {
        return { valid: false, error: 'Missing version' };
      }

      // Check required fields
      if (!backup.servers || !Array.isArray(backup.servers)) {
        return { valid: false, error: 'Invalid servers data' };
      }

      if (!backup.settings || typeof backup.settings !== 'object') {
        return { valid: false, error: 'Invalid settings data' };
      }

      // Verify checksum
      const data = JSON.stringify({ servers: backup.servers, settings: backup.settings });
      const expectedChecksum = this.generateChecksum(data);
      
      if (backup.checksum !== expectedChecksum) {
        return { valid: false, error: 'Checksum mismatch - backup may be corrupted' };
      }

      return { valid: true };
    }

    async encryptBackup(backup: BackupData, password: string): Promise<string> {
      if (!password || password.length < 4) {
        throw new Error('Password must be at least 4 characters');
      }
      
      // Mock encryption (in real app, use Argon2id + AES)
      const data = JSON.stringify(backup);
      const encrypted = Buffer.from(data).toString('base64');
      return `ENCRYPTED:${encrypted}`;
    }

    async decryptBackup(encryptedData: string, password: string): Promise<BackupData> {
      if (!encryptedData.startsWith('ENCRYPTED:')) {
        throw new Error('Invalid encrypted format');
      }

      if (!password) {
        throw new Error('Password required');
      }

      // Mock decryption
      const base64Data = encryptedData.replace('ENCRYPTED:', '');
      const decrypted = Buffer.from(base64Data, 'base64').toString('utf-8');
      return JSON.parse(decrypted);
    }

    formatBackupSize(bytes: number): string {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    }

    generateBackupFilename(): string {
      const date = new Date();
      const dateStr = date.toISOString().split('T')[0];
      const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-');
      return `marix-backup-${dateStr}-${timeStr}.mbak`;
    }
  }

  let backupService: MockBackupService;

  beforeEach(() => {
    backupService = new MockBackupService();
  });

  describe('Backup Creation', () => {
    it('should create a backup with correct structure', async () => {
      const servers = [
        { id: '1', name: 'Server 1', host: '192.168.1.1' },
        { id: '2', name: 'Server 2', host: '192.168.1.2' }
      ];
      const settings = { theme: 'dark', language: 'en' };

      const backup = await backupService.createBackup(servers, settings);

      expect(backup.version).toBe('1.0');
      expect(backup.timestamp).toBeDefined();
      expect(backup.servers).toEqual(servers);
      expect(backup.settings).toEqual(settings);
      expect(backup.checksum).toBeDefined();
    });

    it('should generate consistent checksum', async () => {
      const servers = [{ id: '1', name: 'Test' }];
      const settings = { theme: 'dark' };

      const backup1 = await backupService.createBackup(servers, settings);
      const backup2 = await backupService.createBackup(servers, settings);

      expect(backup1.checksum).toBe(backup2.checksum);
    });

    it('should create empty backup', async () => {
      const backup = await backupService.createBackup([], {});

      expect(backup.servers).toEqual([]);
      expect(backup.settings).toEqual({});
      expect(backup.checksum).toBeDefined();
    });
  });

  describe('Backup Validation', () => {
    it('should validate correct backup', async () => {
      const servers = [{ id: '1', name: 'Test' }];
      const settings = { theme: 'dark' };
      const backup = await backupService.createBackup(servers, settings);

      const result = await backupService.validateBackup(backup);

      expect(result.valid).toBe(true);
    });

    it('should reject backup without version', async () => {
      const backup = {
        timestamp: Date.now(),
        servers: [],
        settings: {},
        checksum: 'abc'
      } as any;

      const result = await backupService.validateBackup(backup);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Missing version');
    });

    it('should reject backup with invalid servers', async () => {
      const backup = {
        version: '1.0',
        timestamp: Date.now(),
        servers: 'not an array',
        settings: {},
        checksum: 'abc'
      } as any;

      const result = await backupService.validateBackup(backup);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid servers data');
    });

    it('should reject corrupted backup (checksum mismatch)', async () => {
      const backup = await backupService.createBackup([{ id: '1' }], {});
      backup.servers.push({ id: '2' }); // Tamper with data

      const result = await backupService.validateBackup(backup);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Checksum mismatch');
    });
  });

  describe('Encryption', () => {
    it('should encrypt backup', async () => {
      const backup = await backupService.createBackup([], {});
      const encrypted = await backupService.encryptBackup(backup, 'password123');

      expect(encrypted).toMatch(/^ENCRYPTED:/);
    });

    it('should reject weak password', async () => {
      const backup = await backupService.createBackup([], {});
      
      await expect(backupService.encryptBackup(backup, '123')).rejects.toThrow('Password must be at least 4 characters');
    });

    it('should decrypt backup correctly', async () => {
      const servers = [{ id: '1', name: 'Test Server' }];
      const settings = { theme: 'dark' };
      const backup = await backupService.createBackup(servers, settings);
      
      const encrypted = await backupService.encryptBackup(backup, 'password123');
      const decrypted = await backupService.decryptBackup(encrypted, 'password123');

      expect(decrypted.servers).toEqual(servers);
      expect(decrypted.settings).toEqual(settings);
    });

    it('should reject invalid encrypted format', async () => {
      await expect(backupService.decryptBackup('invalid data', 'password')).rejects.toThrow('Invalid encrypted format');
    });
  });

  describe('Utilities', () => {
    it('should format backup size correctly', () => {
      expect(backupService.formatBackupSize(500)).toBe('500 B');
      expect(backupService.formatBackupSize(2048)).toBe('2.0 KB');
      expect(backupService.formatBackupSize(1048576)).toBe('1.0 MB');
    });

    it('should generate valid backup filename', () => {
      const filename = backupService.generateBackupFilename();
      
      expect(filename).toMatch(/^marix-backup-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.mbak$/);
    });
  });
});
