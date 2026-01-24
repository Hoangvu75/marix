/**
 * Unit tests for Port Forwarding Service
 * Tests local, remote, and dynamic port forwarding configurations
 */

describe('PortForwardingService', () => {
  type ForwardType = 'local' | 'remote' | 'dynamic';

  interface PortForwardConfig {
    id: string;
    type: ForwardType;
    localPort: number;
    remoteHost?: string;
    remotePort?: number;
    bindAddress?: string;
    enabled: boolean;
  }

  class MockPortForwardingService {
    private forwards: Map<string, PortForwardConfig> = new Map();
    private usedPorts: Set<number> = new Set();

    validateConfig(config: Omit<PortForwardConfig, 'id'>): { valid: boolean; errors: string[] } {
      const errors: string[] = [];

      // Validate type
      if (!['local', 'remote', 'dynamic'].includes(config.type)) {
        errors.push('Invalid forward type');
      }

      // Validate local port
      if (!config.localPort || config.localPort < 1 || config.localPort > 65535) {
        errors.push('Local port must be between 1 and 65535');
      }

      // Validate privileged ports
      if (config.localPort < 1024) {
        errors.push('Warning: Port below 1024 may require elevated privileges');
      }

      // For local and remote forwarding, remote host and port are required
      if (config.type !== 'dynamic') {
        if (!config.remoteHost) {
          errors.push('Remote host is required for local/remote forwarding');
        }
        if (!config.remotePort || config.remotePort < 1 || config.remotePort > 65535) {
          errors.push('Remote port must be between 1 and 65535');
        }
      }

      // Check for port conflicts
      if (this.usedPorts.has(config.localPort)) {
        errors.push(`Port ${config.localPort} is already in use`);
      }

      return { valid: errors.filter(e => !e.startsWith('Warning')).length === 0, errors };
    }

    createForward(config: Omit<PortForwardConfig, 'id'>): PortForwardConfig {
      const validation = this.validateConfig(config);
      if (!validation.valid) {
        throw new Error(validation.errors.join(', '));
      }

      const forward: PortForwardConfig = {
        ...config,
        id: `fwd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };

      this.forwards.set(forward.id, forward);
      if (forward.enabled) {
        this.usedPorts.add(forward.localPort);
      }

      return forward;
    }

    enableForward(id: string): boolean {
      const forward = this.forwards.get(id);
      if (!forward) {
        throw new Error('Forward not found');
      }

      if (this.usedPorts.has(forward.localPort) && !forward.enabled) {
        throw new Error('Port is already in use by another forward');
      }

      forward.enabled = true;
      this.usedPorts.add(forward.localPort);
      return true;
    }

    disableForward(id: string): boolean {
      const forward = this.forwards.get(id);
      if (!forward) {
        throw new Error('Forward not found');
      }

      forward.enabled = false;
      this.usedPorts.delete(forward.localPort);
      return true;
    }

    deleteForward(id: string): boolean {
      const forward = this.forwards.get(id);
      if (!forward) {
        throw new Error('Forward not found');
      }

      if (forward.enabled) {
        this.usedPorts.delete(forward.localPort);
      }
      this.forwards.delete(id);
      return true;
    }

    listForwards(): PortForwardConfig[] {
      return Array.from(this.forwards.values());
    }

    getSSHArgs(config: PortForwardConfig): string {
      switch (config.type) {
        case 'local':
          return `-L ${config.bindAddress || '127.0.0.1'}:${config.localPort}:${config.remoteHost}:${config.remotePort}`;
        case 'remote':
          return `-R ${config.bindAddress || '127.0.0.1'}:${config.localPort}:${config.remoteHost}:${config.remotePort}`;
        case 'dynamic':
          return `-D ${config.bindAddress || '127.0.0.1'}:${config.localPort}`;
        default:
          throw new Error('Invalid forward type');
      }
    }

    formatForwardDescription(config: PortForwardConfig): string {
      switch (config.type) {
        case 'local':
          return `Local :${config.localPort} → ${config.remoteHost}:${config.remotePort}`;
        case 'remote':
          return `Remote :${config.localPort} ← ${config.remoteHost}:${config.remotePort}`;
        case 'dynamic':
          return `SOCKS5 Proxy on :${config.localPort}`;
        default:
          return 'Unknown';
      }
    }
  }

  let service: MockPortForwardingService;

  beforeEach(() => {
    service = new MockPortForwardingService();
  });

  describe('Configuration Validation', () => {
    it('should validate correct local forward config', () => {
      const result = service.validateConfig({
        type: 'local',
        localPort: 8080,
        remoteHost: 'localhost',
        remotePort: 80,
        enabled: false
      });
      expect(result.valid).toBe(true);
    });

    it('should validate correct dynamic forward config', () => {
      const result = service.validateConfig({
        type: 'dynamic',
        localPort: 1080,
        enabled: false
      });
      expect(result.valid).toBe(true);
    });

    it('should reject invalid port', () => {
      const result = service.validateConfig({
        type: 'local',
        localPort: 99999,
        remoteHost: 'localhost',
        remotePort: 80,
        enabled: false
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Local port must be between 1 and 65535');
    });

    it('should require remote host for local forwarding', () => {
      const result = service.validateConfig({
        type: 'local',
        localPort: 8080,
        remotePort: 80,
        enabled: false
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Remote host is required for local/remote forwarding');
    });

    it('should warn about privileged ports', () => {
      const result = service.validateConfig({
        type: 'dynamic',
        localPort: 80,
        enabled: false
      });
      expect(result.errors.some(e => e.includes('elevated privileges'))).toBe(true);
    });
  });

  describe('Forward Management', () => {
    it('should create local forward', () => {
      const forward = service.createForward({
        type: 'local',
        localPort: 8080,
        remoteHost: 'localhost',
        remotePort: 80,
        enabled: true
      });

      expect(forward.id).toBeDefined();
      expect(forward.type).toBe('local');
    });

    it('should create dynamic forward (SOCKS proxy)', () => {
      const forward = service.createForward({
        type: 'dynamic',
        localPort: 1080,
        enabled: true
      });

      expect(forward.type).toBe('dynamic');
    });

    it('should prevent duplicate port usage', () => {
      service.createForward({
        type: 'local',
        localPort: 8080,
        remoteHost: 'localhost',
        remotePort: 80,
        enabled: true
      });

      expect(() => service.createForward({
        type: 'local',
        localPort: 8080,
        remoteHost: 'localhost',
        remotePort: 443,
        enabled: true
      })).toThrow('Port 8080 is already in use');
    });

    it('should enable/disable forwards', () => {
      const forward = service.createForward({
        type: 'local',
        localPort: 8080,
        remoteHost: 'localhost',
        remotePort: 80,
        enabled: false
      });

      service.enableForward(forward.id);
      expect(service.listForwards()[0].enabled).toBe(true);

      service.disableForward(forward.id);
      expect(service.listForwards()[0].enabled).toBe(false);
    });

    it('should delete forward', () => {
      const forward = service.createForward({
        type: 'local',
        localPort: 8080,
        remoteHost: 'localhost',
        remotePort: 80,
        enabled: true
      });

      service.deleteForward(forward.id);
      expect(service.listForwards().length).toBe(0);
    });
  });

  describe('SSH Arguments Generation', () => {
    it('should generate correct local forward args', () => {
      const config: PortForwardConfig = {
        id: '1',
        type: 'local',
        localPort: 8080,
        remoteHost: 'db.internal',
        remotePort: 3306,
        enabled: true
      };

      expect(service.getSSHArgs(config)).toBe('-L 127.0.0.1:8080:db.internal:3306');
    });

    it('should generate correct remote forward args', () => {
      const config: PortForwardConfig = {
        id: '1',
        type: 'remote',
        localPort: 8080,
        remoteHost: 'localhost',
        remotePort: 80,
        enabled: true
      };

      expect(service.getSSHArgs(config)).toBe('-R 127.0.0.1:8080:localhost:80');
    });

    it('should generate correct dynamic forward args', () => {
      const config: PortForwardConfig = {
        id: '1',
        type: 'dynamic',
        localPort: 1080,
        enabled: true
      };

      expect(service.getSSHArgs(config)).toBe('-D 127.0.0.1:1080');
    });

    it('should use custom bind address', () => {
      const config: PortForwardConfig = {
        id: '1',
        type: 'local',
        localPort: 8080,
        remoteHost: 'localhost',
        remotePort: 80,
        bindAddress: '0.0.0.0',
        enabled: true
      };

      expect(service.getSSHArgs(config)).toBe('-L 0.0.0.0:8080:localhost:80');
    });
  });

  describe('Description Formatting', () => {
    it('should format local forward description', () => {
      const config: PortForwardConfig = {
        id: '1',
        type: 'local',
        localPort: 8080,
        remoteHost: 'db.internal',
        remotePort: 3306,
        enabled: true
      };

      expect(service.formatForwardDescription(config)).toBe('Local :8080 → db.internal:3306');
    });

    it('should format remote forward description', () => {
      const config: PortForwardConfig = {
        id: '1',
        type: 'remote',
        localPort: 8080,
        remoteHost: 'localhost',
        remotePort: 80,
        enabled: true
      };

      expect(service.formatForwardDescription(config)).toBe('Remote :8080 ← localhost:80');
    });

    it('should format dynamic forward description', () => {
      const config: PortForwardConfig = {
        id: '1',
        type: 'dynamic',
        localPort: 1080,
        enabled: true
      };

      expect(service.formatForwardDescription(config)).toBe('SOCKS5 Proxy on :1080');
    });
  });
});
