/**
 * Unit tests for Cloudflare DNS Service
 * Tests DNS record operations and validation
 */

describe('CloudflareService', () => {
  type DNSRecordType = 'A' | 'AAAA' | 'CNAME' | 'TXT' | 'MX' | 'NS';

  interface DNSRecord {
    id: string;
    type: DNSRecordType;
    name: string;
    content: string;
    ttl: number;
    proxied?: boolean;
    priority?: number;
  }

  class MockCloudflareService {
    private records: Map<string, DNSRecord> = new Map();

    validateApiKey(apiKey: string): boolean {
      // Cloudflare API keys are typically 37 characters
      return /^[a-zA-Z0-9_-]{37,}$/.test(apiKey);
    }

    validateZoneId(zoneId: string): boolean {
      // Zone IDs are 32 character hex strings
      return /^[a-f0-9]{32}$/.test(zoneId);
    }

    validateDNSRecord(record: Partial<DNSRecord>): { valid: boolean; errors: string[] } {
      const errors: string[] = [];

      if (!record.type) {
        errors.push('Record type is required');
      }

      if (!record.name) {
        errors.push('Record name is required');
      } else if (!/^[a-zA-Z0-9@._-]+$/.test(record.name)) {
        errors.push('Invalid record name format');
      }

      if (!record.content) {
        errors.push('Record content is required');
      }

      // Type-specific validation
      if (record.type === 'A' && record.content) {
        if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(record.content)) {
          errors.push('A record must contain valid IPv4 address');
        }
      }

      if (record.type === 'AAAA' && record.content) {
        if (!/^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(record.content) &&
            !/^([0-9a-fA-F]{1,4}:){1,7}:$/.test(record.content) &&
            !/^::([0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}$/.test(record.content)) {
          errors.push('AAAA record must contain valid IPv6 address');
        }
      }

      if (record.type === 'MX') {
        if (!record.priority || record.priority < 0 || record.priority > 65535) {
          errors.push('MX record must have valid priority (0-65535)');
        }
      }

      if (record.ttl !== undefined && (record.ttl < 1 || record.ttl > 86400)) {
        if (record.ttl !== 1) { // 1 = Auto TTL
          errors.push('TTL must be between 1 (auto) and 86400');
        }
      }

      return { valid: errors.length === 0, errors };
    }

    async createRecord(zoneId: string, record: Omit<DNSRecord, 'id'>): Promise<DNSRecord> {
      const validation = this.validateDNSRecord(record);
      if (!validation.valid) {
        throw new Error(validation.errors.join(', '));
      }

      const newRecord: DNSRecord = {
        ...record,
        id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };

      this.records.set(newRecord.id, newRecord);
      return newRecord;
    }

    async updateRecord(recordId: string, updates: Partial<DNSRecord>): Promise<DNSRecord> {
      const record = this.records.get(recordId);
      if (!record) {
        throw new Error('Record not found');
      }

      const updatedRecord = { ...record, ...updates };
      const validation = this.validateDNSRecord(updatedRecord);
      if (!validation.valid) {
        throw new Error(validation.errors.join(', '));
      }

      this.records.set(recordId, updatedRecord);
      return updatedRecord;
    }

    async deleteRecord(recordId: string): Promise<boolean> {
      if (!this.records.has(recordId)) {
        throw new Error('Record not found');
      }
      this.records.delete(recordId);
      return true;
    }

    async listRecords(zoneId: string, type?: DNSRecordType): Promise<DNSRecord[]> {
      let records = Array.from(this.records.values());
      if (type) {
        records = records.filter(r => r.type === type);
      }
      return records;
    }

    formatTTL(seconds: number): string {
      if (seconds === 1) return 'Auto';
      if (seconds < 60) return `${seconds}s`;
      if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
      if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
      return `${Math.floor(seconds / 86400)}d`;
    }
  }

  let cf: MockCloudflareService;

  beforeEach(() => {
    cf = new MockCloudflareService();
  });

  describe('API Key Validation', () => {
    it('should accept valid API key', () => {
      expect(cf.validateApiKey('abcdefghijklmnopqrstuvwxyz0123456789a')).toBe(true);
    });

    it('should reject short API key', () => {
      expect(cf.validateApiKey('shortkey')).toBe(false);
    });

    it('should reject invalid characters', () => {
      expect(cf.validateApiKey('invalid key with spaces!@#$%^&*()')).toBe(false);
    });
  });

  describe('Zone ID Validation', () => {
    it('should accept valid zone ID', () => {
      expect(cf.validateZoneId('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4')).toBe(true);
    });

    it('should reject invalid zone ID', () => {
      expect(cf.validateZoneId('invalid')).toBe(false);
      expect(cf.validateZoneId('UPPERCASE1234567890ABCDEF12345678')).toBe(false);
    });
  });

  describe('DNS Record Validation', () => {
    it('should validate correct A record', () => {
      const result = cf.validateDNSRecord({
        type: 'A',
        name: 'www',
        content: '192.168.1.1',
        ttl: 300
      });
      expect(result.valid).toBe(true);
    });

    it('should reject A record with invalid IP', () => {
      const result = cf.validateDNSRecord({
        type: 'A',
        name: 'www',
        content: 'not.an.ip',
        ttl: 300
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('A record must contain valid IPv4 address');
    });

    it('should require priority for MX records', () => {
      const result = cf.validateDNSRecord({
        type: 'MX',
        name: '@',
        content: 'mail.example.com',
        ttl: 300
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('MX record must have valid priority (0-65535)');
    });

    it('should validate MX record with priority', () => {
      const result = cf.validateDNSRecord({
        type: 'MX',
        name: '@',
        content: 'mail.example.com',
        ttl: 300,
        priority: 10
      });
      expect(result.valid).toBe(true);
    });

    it('should reject missing required fields', () => {
      const result = cf.validateDNSRecord({});
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Record type is required');
      expect(result.errors).toContain('Record name is required');
      expect(result.errors).toContain('Record content is required');
    });
  });

  describe('CRUD Operations', () => {
    it('should create DNS record', async () => {
      const record = await cf.createRecord('zone123', {
        type: 'A',
        name: 'www',
        content: '192.168.1.1',
        ttl: 300
      });

      expect(record.id).toBeDefined();
      expect(record.type).toBe('A');
      expect(record.name).toBe('www');
    });

    it('should update DNS record', async () => {
      const record = await cf.createRecord('zone123', {
        type: 'A',
        name: 'www',
        content: '192.168.1.1',
        ttl: 300
      });

      const updated = await cf.updateRecord(record.id, { content: '192.168.1.2' });
      expect(updated.content).toBe('192.168.1.2');
    });

    it('should delete DNS record', async () => {
      const record = await cf.createRecord('zone123', {
        type: 'A',
        name: 'www',
        content: '192.168.1.1',
        ttl: 300
      });

      const result = await cf.deleteRecord(record.id);
      expect(result).toBe(true);

      const records = await cf.listRecords('zone123');
      expect(records.find(r => r.id === record.id)).toBeUndefined();
    });

    it('should list records by type', async () => {
      await cf.createRecord('zone123', { type: 'A', name: 'www', content: '1.1.1.1', ttl: 300 });
      await cf.createRecord('zone123', { type: 'CNAME', name: 'api', content: 'www.example.com', ttl: 300 });
      await cf.createRecord('zone123', { type: 'A', name: 'mail', content: '2.2.2.2', ttl: 300 });

      const aRecords = await cf.listRecords('zone123', 'A');
      expect(aRecords.length).toBe(2);
      expect(aRecords.every(r => r.type === 'A')).toBe(true);
    });
  });

  describe('TTL Formatting', () => {
    it('should format TTL correctly', () => {
      expect(cf.formatTTL(1)).toBe('Auto');
      expect(cf.formatTTL(30)).toBe('30s');
      expect(cf.formatTTL(120)).toBe('2m');
      expect(cf.formatTTL(3600)).toBe('1h');
      expect(cf.formatTTL(86400)).toBe('1d');
    });
  });
});
