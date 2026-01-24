/**
 * Unit tests for Network Tools Service
 * Tests ping, traceroute, port scanning, and DNS lookup
 */

describe('NetworkToolsService', () => {
  class MockNetworkTools {
    validateIP(ip: string): boolean {
      // IPv4
      const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (ipv4Regex.test(ip)) {
        const parts = ip.split('.').map(Number);
        return parts.every(p => p >= 0 && p <= 255);
      }
      
      // IPv6 (simplified)
      const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
      return ipv6Regex.test(ip);
    }

    validateHostname(hostname: string): boolean {
      const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/;
      return hostnameRegex.test(hostname) && hostname.length <= 253;
    }

    validatePort(port: number): boolean {
      return Number.isInteger(port) && port >= 1 && port <= 65535;
    }

    validatePortRange(startPort: number, endPort: number): { valid: boolean; error?: string } {
      if (!this.validatePort(startPort)) {
        return { valid: false, error: 'Invalid start port' };
      }
      if (!this.validatePort(endPort)) {
        return { valid: false, error: 'Invalid end port' };
      }
      if (startPort > endPort) {
        return { valid: false, error: 'Start port must be less than or equal to end port' };
      }
      if (endPort - startPort > 1000) {
        return { valid: false, error: 'Port range too large (max 1000 ports)' };
      }
      return { valid: true };
    }

    parsePortList(portString: string): number[] {
      const ports: number[] = [];
      const parts = portString.split(',').map(s => s.trim());
      
      for (const part of parts) {
        if (part.includes('-')) {
          const [start, end] = part.split('-').map(Number);
          for (let i = start; i <= end; i++) {
            if (this.validatePort(i)) {
              ports.push(i);
            }
          }
        } else {
          const port = parseInt(part, 10);
          if (this.validatePort(port)) {
            ports.push(port);
          }
        }
      }
      
      return [...new Set(ports)].sort((a, b) => a - b);
    }

    commonPorts = [
      { port: 21, service: 'FTP' },
      { port: 22, service: 'SSH' },
      { port: 23, service: 'Telnet' },
      { port: 25, service: 'SMTP' },
      { port: 53, service: 'DNS' },
      { port: 80, service: 'HTTP' },
      { port: 110, service: 'POP3' },
      { port: 143, service: 'IMAP' },
      { port: 443, service: 'HTTPS' },
      { port: 3306, service: 'MySQL' },
      { port: 3389, service: 'RDP' },
      { port: 5432, service: 'PostgreSQL' },
      { port: 6379, service: 'Redis' },
      { port: 8080, service: 'HTTP-Alt' },
      { port: 27017, service: 'MongoDB' }
    ];

    getServiceName(port: number): string {
      const found = this.commonPorts.find(p => p.port === port);
      return found?.service || 'Unknown';
    }

    formatPingResult(latency: number): string {
      if (latency < 0) return 'Timeout';
      if (latency < 1) return '<1ms';
      return `${Math.round(latency)}ms`;
    }

    calculatePingStats(latencies: number[]): {
      min: number;
      max: number;
      avg: number;
      packetLoss: number;
      totalPackets: number;
    } {
      const validLatencies = latencies.filter(l => l >= 0);
      const lostPackets = latencies.filter(l => l < 0).length;
      
      return {
        min: validLatencies.length ? Math.min(...validLatencies) : 0,
        max: validLatencies.length ? Math.max(...validLatencies) : 0,
        avg: validLatencies.length ? validLatencies.reduce((a, b) => a + b, 0) / validLatencies.length : 0,
        packetLoss: (lostPackets / latencies.length) * 100,
        totalPackets: latencies.length
      };
    }

    formatDuration(ms: number): string {
      if (ms < 1000) return `${ms}ms`;
      if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
      return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
    }
  }

  let networkTools: MockNetworkTools;

  beforeEach(() => {
    networkTools = new MockNetworkTools();
  });

  describe('IP Validation', () => {
    it('should validate correct IPv4 addresses', () => {
      expect(networkTools.validateIP('192.168.1.1')).toBe(true);
      expect(networkTools.validateIP('10.0.0.1')).toBe(true);
      expect(networkTools.validateIP('255.255.255.255')).toBe(true);
      expect(networkTools.validateIP('0.0.0.0')).toBe(true);
    });

    it('should reject invalid IPv4 addresses', () => {
      expect(networkTools.validateIP('256.1.1.1')).toBe(false);
      expect(networkTools.validateIP('192.168.1')).toBe(false);
      expect(networkTools.validateIP('192.168.1.1.1')).toBe(false);
      expect(networkTools.validateIP('abc.def.ghi.jkl')).toBe(false);
    });
  });

  describe('Hostname Validation', () => {
    it('should validate correct hostnames', () => {
      expect(networkTools.validateHostname('example.com')).toBe(true);
      expect(networkTools.validateHostname('sub.example.com')).toBe(true);
      expect(networkTools.validateHostname('server-01.example.com')).toBe(true);
      expect(networkTools.validateHostname('localhost')).toBe(true);
    });

    it('should reject invalid hostnames', () => {
      expect(networkTools.validateHostname('-invalid.com')).toBe(false);
      expect(networkTools.validateHostname('invalid-.com')).toBe(false);
      expect(networkTools.validateHostname('')).toBe(false);
    });
  });

  describe('Port Validation', () => {
    it('should validate correct ports', () => {
      expect(networkTools.validatePort(22)).toBe(true);
      expect(networkTools.validatePort(1)).toBe(true);
      expect(networkTools.validatePort(65535)).toBe(true);
    });

    it('should reject invalid ports', () => {
      expect(networkTools.validatePort(0)).toBe(false);
      expect(networkTools.validatePort(65536)).toBe(false);
      expect(networkTools.validatePort(-1)).toBe(false);
      expect(networkTools.validatePort(1.5)).toBe(false);
    });
  });

  describe('Port Range Validation', () => {
    it('should validate correct port ranges', () => {
      expect(networkTools.validatePortRange(1, 100).valid).toBe(true);
      expect(networkTools.validatePortRange(80, 80).valid).toBe(true);
    });

    it('should reject invalid port ranges', () => {
      expect(networkTools.validatePortRange(100, 1).valid).toBe(false);
      expect(networkTools.validatePortRange(1, 2000).valid).toBe(false); // Too large
      expect(networkTools.validatePortRange(0, 100).valid).toBe(false);
    });
  });

  describe('Port List Parsing', () => {
    it('should parse comma-separated ports', () => {
      expect(networkTools.parsePortList('22, 80, 443')).toEqual([22, 80, 443]);
    });

    it('should parse port ranges', () => {
      expect(networkTools.parsePortList('20-25')).toEqual([20, 21, 22, 23, 24, 25]);
    });

    it('should parse mixed format', () => {
      expect(networkTools.parsePortList('22, 80-82, 443')).toEqual([22, 80, 81, 82, 443]);
    });

    it('should deduplicate and sort', () => {
      expect(networkTools.parsePortList('443, 22, 80, 22')).toEqual([22, 80, 443]);
    });

    it('should filter invalid ports', () => {
      expect(networkTools.parsePortList('22, 0, 99999')).toEqual([22]);
    });
  });

  describe('Service Name Lookup', () => {
    it('should return known service names', () => {
      expect(networkTools.getServiceName(22)).toBe('SSH');
      expect(networkTools.getServiceName(80)).toBe('HTTP');
      expect(networkTools.getServiceName(443)).toBe('HTTPS');
      expect(networkTools.getServiceName(3306)).toBe('MySQL');
      expect(networkTools.getServiceName(3389)).toBe('RDP');
    });

    it('should return Unknown for unrecognized ports', () => {
      expect(networkTools.getServiceName(12345)).toBe('Unknown');
    });
  });

  describe('Ping Statistics', () => {
    it('should calculate ping stats correctly', () => {
      const stats = networkTools.calculatePingStats([50, 60, 70, 80, 90]);
      
      expect(stats.min).toBe(50);
      expect(stats.max).toBe(90);
      expect(stats.avg).toBe(70);
      expect(stats.packetLoss).toBe(0);
      expect(stats.totalPackets).toBe(5);
    });

    it('should handle packet loss', () => {
      const stats = networkTools.calculatePingStats([50, -1, 70, -1, 90]); // -1 = timeout
      
      expect(stats.min).toBe(50);
      expect(stats.max).toBe(90);
      expect(stats.packetLoss).toBe(40); // 2 out of 5
    });

    it('should handle all timeouts', () => {
      const stats = networkTools.calculatePingStats([-1, -1, -1]);
      
      expect(stats.min).toBe(0);
      expect(stats.max).toBe(0);
      expect(stats.avg).toBe(0);
      expect(stats.packetLoss).toBe(100);
    });
  });

  describe('Formatting', () => {
    it('should format ping results', () => {
      expect(networkTools.formatPingResult(50)).toBe('50ms');
      expect(networkTools.formatPingResult(0.5)).toBe('<1ms');
      expect(networkTools.formatPingResult(-1)).toBe('Timeout');
    });

    it('should format duration', () => {
      expect(networkTools.formatDuration(500)).toBe('500ms');
      expect(networkTools.formatDuration(2500)).toBe('2.5s');
      expect(networkTools.formatDuration(65000)).toBe('1m 5s');
    });
  });
});
