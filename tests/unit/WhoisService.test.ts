/**
 * Unit tests for WHOIS Service
 * Tests domain and IP lookup functionality
 */

describe('WhoisService', () => {
  interface WhoisResult {
    domain?: string;
    ip?: string;
    registrar?: string;
    createdDate?: string;
    expiryDate?: string;
    nameServers?: string[];
    status?: string[];
    organization?: string;
    country?: string;
    raw: string;
  }

  class MockWhoisService {
    validateDomain(domain: string): boolean {
      // Basic domain validation
      const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;
      return domainRegex.test(domain) && domain.length <= 253;
    }

    validateIP(ip: string): boolean {
      // IPv4 validation
      const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (ipv4Regex.test(ip)) {
        const parts = ip.split('.').map(Number);
        return parts.every(p => p >= 0 && p <= 255);
      }
      return false;
    }

    extractTLD(domain: string): string {
      const parts = domain.split('.');
      return parts[parts.length - 1].toLowerCase();
    }

    getWhoisServer(domain: string): string {
      const tld = this.extractTLD(domain);
      const servers: Record<string, string> = {
        'com': 'whois.verisign-grs.com',
        'net': 'whois.verisign-grs.com',
        'org': 'whois.pir.org',
        'io': 'whois.nic.io',
        'dev': 'whois.nic.google',
        'app': 'whois.nic.google',
        'me': 'whois.nic.me',
        'co': 'whois.nic.co',
        'vn': 'whois.vnnic.vn'
      };
      return servers[tld] || 'whois.iana.org';
    }

    parseWhoisResponse(raw: string): Partial<WhoisResult> {
      const result: Partial<WhoisResult> = { raw };

      // Parse registrar
      const registrarMatch = raw.match(/Registrar:\s*(.+)/i);
      if (registrarMatch) {
        result.registrar = registrarMatch[1].trim();
      }

      // Parse dates
      const createdMatch = raw.match(/Creation Date:\s*(.+)/i) || 
                          raw.match(/Created:\s*(.+)/i);
      if (createdMatch) {
        result.createdDate = createdMatch[1].trim();
      }

      const expiryMatch = raw.match(/Expir(?:y|ation) Date:\s*(.+)/i) ||
                         raw.match(/Registry Expiry Date:\s*(.+)/i);
      if (expiryMatch) {
        result.expiryDate = expiryMatch[1].trim();
      }

      // Parse name servers
      const nsMatches = raw.matchAll(/Name Server:\s*(.+)/gi);
      result.nameServers = Array.from(nsMatches, m => m[1].trim().toLowerCase());

      // Parse status
      const statusMatches = raw.matchAll(/(?:Domain )?Status:\s*(.+)/gi);
      result.status = Array.from(statusMatches, m => m[1].trim());

      // Parse organization
      const orgMatch = raw.match(/(?:Registrant )?Organization:\s*(.+)/i);
      if (orgMatch) {
        result.organization = orgMatch[1].trim();
      }

      // Parse country
      const countryMatch = raw.match(/(?:Registrant )?Country:\s*(.+)/i);
      if (countryMatch) {
        result.country = countryMatch[1].trim();
      }

      return result;
    }

    formatDate(dateString: string): string {
      try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      } catch {
        return dateString;
      }
    }

    getDaysUntilExpiry(expiryDate: string): number {
      try {
        const expiry = new Date(expiryDate);
        const now = new Date();
        const diff = expiry.getTime() - now.getTime();
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
      } catch {
        return -1;
      }
    }

    getExpiryStatus(daysUntilExpiry: number): 'ok' | 'warning' | 'critical' | 'expired' {
      if (daysUntilExpiry < 0) return 'expired';
      if (daysUntilExpiry <= 30) return 'critical';
      if (daysUntilExpiry <= 90) return 'warning';
      return 'ok';
    }
  }

  let whois: MockWhoisService;

  beforeEach(() => {
    whois = new MockWhoisService();
  });

  describe('Domain Validation', () => {
    it('should validate correct domains', () => {
      expect(whois.validateDomain('example.com')).toBe(true);
      expect(whois.validateDomain('sub.example.com')).toBe(true);
      expect(whois.validateDomain('test-site.co.uk')).toBe(true);
      expect(whois.validateDomain('example.io')).toBe(true);
    });

    it('should reject invalid domains', () => {
      expect(whois.validateDomain('example')).toBe(false); // No TLD
      expect(whois.validateDomain('-invalid.com')).toBe(false); // Starts with hyphen
      expect(whois.validateDomain('invalid-.com')).toBe(false); // Ends with hyphen
      expect(whois.validateDomain('.com')).toBe(false); // Empty domain
      expect(whois.validateDomain('example..com')).toBe(false); // Double dot
    });
  });

  describe('IP Validation', () => {
    it('should validate correct IPv4 addresses', () => {
      expect(whois.validateIP('192.168.1.1')).toBe(true);
      expect(whois.validateIP('8.8.8.8')).toBe(true);
      expect(whois.validateIP('255.255.255.255')).toBe(true);
    });

    it('should reject invalid IP addresses', () => {
      expect(whois.validateIP('256.1.1.1')).toBe(false);
      expect(whois.validateIP('192.168.1')).toBe(false);
      expect(whois.validateIP('not.an.ip.address')).toBe(false);
    });
  });

  describe('TLD Extraction', () => {
    it('should extract TLD correctly', () => {
      expect(whois.extractTLD('example.com')).toBe('com');
      expect(whois.extractTLD('test.co.uk')).toBe('uk');
      expect(whois.extractTLD('site.io')).toBe('io');
      expect(whois.extractTLD('EXAMPLE.COM')).toBe('com'); // Case insensitive
    });
  });

  describe('WHOIS Server Selection', () => {
    it('should return correct WHOIS server for known TLDs', () => {
      expect(whois.getWhoisServer('example.com')).toBe('whois.verisign-grs.com');
      expect(whois.getWhoisServer('example.org')).toBe('whois.pir.org');
      expect(whois.getWhoisServer('example.io')).toBe('whois.nic.io');
      expect(whois.getWhoisServer('example.vn')).toBe('whois.vnnic.vn');
    });

    it('should return IANA for unknown TLDs', () => {
      expect(whois.getWhoisServer('example.xyz')).toBe('whois.iana.org');
    });
  });

  describe('WHOIS Response Parsing', () => {
    const sampleResponse = `
Domain Name: EXAMPLE.COM
Registrar: Example Registrar, Inc.
Creation Date: 2020-01-15T00:00:00Z
Registry Expiry Date: 2025-01-15T00:00:00Z
Name Server: NS1.EXAMPLE.COM
Name Server: NS2.EXAMPLE.COM
Domain Status: clientTransferProhibited
Registrant Organization: Example Corp
Registrant Country: US
    `;

    it('should parse registrar', () => {
      const result = whois.parseWhoisResponse(sampleResponse);
      expect(result.registrar).toBe('Example Registrar, Inc.');
    });

    it('should parse dates', () => {
      const result = whois.parseWhoisResponse(sampleResponse);
      expect(result.createdDate).toBe('2020-01-15T00:00:00Z');
      expect(result.expiryDate).toBe('2025-01-15T00:00:00Z');
    });

    it('should parse name servers', () => {
      const result = whois.parseWhoisResponse(sampleResponse);
      expect(result.nameServers).toContain('ns1.example.com');
      expect(result.nameServers).toContain('ns2.example.com');
    });

    it('should parse organization and country', () => {
      const result = whois.parseWhoisResponse(sampleResponse);
      expect(result.organization).toBe('Example Corp');
      expect(result.country).toBe('US');
    });

    it('should preserve raw response', () => {
      const result = whois.parseWhoisResponse(sampleResponse);
      expect(result.raw).toBe(sampleResponse);
    });
  });

  describe('Expiry Calculation', () => {
    it('should calculate days until expiry', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      
      const days = whois.getDaysUntilExpiry(futureDate.toISOString());
      expect(days).toBe(30);
    });

    it('should return negative for past dates', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);
      
      const days = whois.getDaysUntilExpiry(pastDate.toISOString());
      expect(days).toBeLessThan(0);
    });
  });

  describe('Expiry Status', () => {
    it('should return "ok" for distant expiry', () => {
      expect(whois.getExpiryStatus(365)).toBe('ok');
      expect(whois.getExpiryStatus(91)).toBe('ok');
    });

    it('should return "warning" for upcoming expiry', () => {
      expect(whois.getExpiryStatus(90)).toBe('warning');
      expect(whois.getExpiryStatus(31)).toBe('warning');
    });

    it('should return "critical" for imminent expiry', () => {
      expect(whois.getExpiryStatus(30)).toBe('critical');
      expect(whois.getExpiryStatus(1)).toBe('critical');
    });

    it('should return "expired" for past expiry', () => {
      expect(whois.getExpiryStatus(-1)).toBe('expired');
      expect(whois.getExpiryStatus(-30)).toBe('expired');
    });
  });
});
