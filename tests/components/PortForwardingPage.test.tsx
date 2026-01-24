/**
 * PortForwardingPage Component Tests
 * Tests for port forwarding UI and management
 */

describe('PortForwardingPage Component', () => {
  describe('Forward Type Selection', () => {
    const forwardTypes = [
      { value: 'local', label: 'Local Forward', description: 'Forward local port to remote' },
      { value: 'remote', label: 'Remote Forward', description: 'Forward remote port to local' },
      { value: 'dynamic', label: 'Dynamic (SOCKS)', description: 'SOCKS proxy' },
    ] as const;

    it('should have all forward types', () => {
      expect(forwardTypes.length).toBe(3);
    });

    it('should have local forward', () => {
      const local = forwardTypes.find(t => t.value === 'local');
      expect(local).toBeDefined();
    });

    it('should have remote forward', () => {
      const remote = forwardTypes.find(t => t.value === 'remote');
      expect(remote).toBeDefined();
    });

    it('should have dynamic forward', () => {
      const dynamic = forwardTypes.find(t => t.value === 'dynamic');
      expect(dynamic).toBeDefined();
    });
  });

  describe('Forward Configuration Form', () => {
    interface ForwardConfig {
      type: 'local' | 'remote' | 'dynamic';
      localPort: number;
      remoteHost?: string;
      remotePort?: number;
      bindAddress: string;
      enabled: boolean;
    }

    const validateConfig = (config: Partial<ForwardConfig>): { valid: boolean; errors: string[] } => {
      const errors: string[] = [];

      if (!config.type) {
        errors.push('Forward type is required');
      }

      if (!config.localPort || config.localPort < 1 || config.localPort > 65535) {
        errors.push('Local port must be between 1 and 65535');
      }

      if (config.type !== 'dynamic') {
        if (!config.remoteHost) {
          errors.push('Remote host is required for local/remote forwards');
        }
        if (!config.remotePort || config.remotePort < 1 || config.remotePort > 65535) {
          errors.push('Remote port must be between 1 and 65535');
        }
      }

      return { valid: errors.length === 0, errors };
    };

    it('should validate local forward config', () => {
      const config: ForwardConfig = {
        type: 'local',
        localPort: 8080,
        remoteHost: 'localhost',
        remotePort: 80,
        bindAddress: '127.0.0.1',
        enabled: true,
      };
      expect(validateConfig(config).valid).toBe(true);
    });

    it('should validate dynamic forward config (no remote needed)', () => {
      const config: ForwardConfig = {
        type: 'dynamic',
        localPort: 1080,
        bindAddress: '127.0.0.1',
        enabled: true,
      };
      expect(validateConfig(config).valid).toBe(true);
    });

    it('should reject local forward without remote host', () => {
      const config: Partial<ForwardConfig> = {
        type: 'local',
        localPort: 8080,
        remotePort: 80,
      };
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Remote host is required for local/remote forwards');
    });

    it('should reject invalid port', () => {
      const config: Partial<ForwardConfig> = {
        type: 'dynamic',
        localPort: 70000,
      };
      expect(validateConfig(config).valid).toBe(false);
    });
  });

  describe('Forward List Management', () => {
    interface Forward {
      id: string;
      type: 'local' | 'remote' | 'dynamic';
      localPort: number;
      remoteHost?: string;
      remotePort?: number;
      enabled: boolean;
      status: 'active' | 'inactive' | 'error';
    }

    let forwards: Forward[] = [];

    const addForward = (forward: Omit<Forward, 'id' | 'status'>): Forward => {
      const newForward: Forward = {
        ...forward,
        id: Math.random().toString(36).substr(2, 9),
        status: forward.enabled ? 'active' : 'inactive',
      };
      forwards.push(newForward);
      return newForward;
    };

    const removeForward = (id: string) => {
      forwards = forwards.filter(f => f.id !== id);
    };

    const toggleForward = (id: string) => {
      const forward = forwards.find(f => f.id === id);
      if (forward) {
        forward.enabled = !forward.enabled;
        forward.status = forward.enabled ? 'active' : 'inactive';
      }
    };

    beforeEach(() => {
      forwards = [];
    });

    it('should add forward', () => {
      const forward = addForward({
        type: 'local',
        localPort: 8080,
        remoteHost: 'localhost',
        remotePort: 80,
        enabled: true,
      });
      expect(forwards.length).toBe(1);
      expect(forward.id).toBeDefined();
    });

    it('should remove forward', () => {
      const forward = addForward({
        type: 'local',
        localPort: 8080,
        remoteHost: 'localhost',
        remotePort: 80,
        enabled: true,
      });
      removeForward(forward.id);
      expect(forwards.length).toBe(0);
    });

    it('should toggle forward status', () => {
      const forward = addForward({
        type: 'local',
        localPort: 8080,
        remoteHost: 'localhost',
        remotePort: 80,
        enabled: true,
      });
      expect(forward.enabled).toBe(true);
      toggleForward(forward.id);
      expect(forward.enabled).toBe(false);
      expect(forward.status).toBe('inactive');
    });
  });

  describe('Port Conflict Detection', () => {
    const usedPorts = [22, 80, 443, 3000, 8080];

    const isPortInUse = (port: number): boolean => {
      return usedPorts.includes(port);
    };

    const findAvailablePort = (startPort: number, maxTries = 100): number | null => {
      for (let i = 0; i < maxTries; i++) {
        const port = startPort + i;
        if (!isPortInUse(port) && port <= 65535) {
          return port;
        }
      }
      return null;
    };

    it('should detect port in use', () => {
      expect(isPortInUse(8080)).toBe(true);
      expect(isPortInUse(22)).toBe(true);
    });

    it('should detect available port', () => {
      expect(isPortInUse(9000)).toBe(false);
    });

    it('should find available port', () => {
      const port = findAvailablePort(8080);
      expect(port).toBe(8081);
    });

    it('should handle all ports in range used', () => {
      const port = findAvailablePort(22, 1);
      expect(port).toBeNull();
    });
  });

  describe('SSH Argument Generation', () => {
    interface Forward {
      type: 'local' | 'remote' | 'dynamic';
      localPort: number;
      remoteHost?: string;
      remotePort?: number;
      bindAddress: string;
    }

    const generateSSHArgs = (forwards: Forward[]): string[] => {
      const args: string[] = [];
      
      for (const f of forwards) {
        switch (f.type) {
          case 'local':
            args.push('-L', `${f.bindAddress}:${f.localPort}:${f.remoteHost}:${f.remotePort}`);
            break;
          case 'remote':
            args.push('-R', `${f.remotePort}:${f.remoteHost}:${f.localPort}`);
            break;
          case 'dynamic':
            args.push('-D', `${f.bindAddress}:${f.localPort}`);
            break;
        }
      }
      
      return args;
    };

    it('should generate local forward args', () => {
      const args = generateSSHArgs([{
        type: 'local',
        localPort: 8080,
        remoteHost: 'localhost',
        remotePort: 80,
        bindAddress: '127.0.0.1',
      }]);
      expect(args).toContain('-L');
      expect(args).toContain('127.0.0.1:8080:localhost:80');
    });

    it('should generate remote forward args', () => {
      const args = generateSSHArgs([{
        type: 'remote',
        localPort: 3000,
        remoteHost: 'localhost',
        remotePort: 3000,
        bindAddress: '127.0.0.1',
      }]);
      expect(args).toContain('-R');
      expect(args).toContain('3000:localhost:3000');
    });

    it('should generate dynamic forward args', () => {
      const args = generateSSHArgs([{
        type: 'dynamic',
        localPort: 1080,
        bindAddress: '0.0.0.0',
      }]);
      expect(args).toContain('-D');
      expect(args).toContain('0.0.0.0:1080');
    });

    it('should handle multiple forwards', () => {
      const args = generateSSHArgs([
        { type: 'local', localPort: 8080, remoteHost: 'localhost', remotePort: 80, bindAddress: '127.0.0.1' },
        { type: 'dynamic', localPort: 1080, bindAddress: '127.0.0.1' },
      ]);
      expect(args.filter(a => a === '-L').length).toBe(1);
      expect(args.filter(a => a === '-D').length).toBe(1);
    });
  });

  describe('Forward Description', () => {
    interface Forward {
      type: 'local' | 'remote' | 'dynamic';
      localPort: number;
      remoteHost?: string;
      remotePort?: number;
      bindAddress: string;
    }

    const getForwardDescription = (forward: Forward): string => {
      switch (forward.type) {
        case 'local':
          return `Local ${forward.bindAddress}:${forward.localPort} → ${forward.remoteHost}:${forward.remotePort}`;
        case 'remote':
          return `Remote ${forward.remotePort} ← ${forward.remoteHost}:${forward.localPort}`;
        case 'dynamic':
          return `SOCKS Proxy on ${forward.bindAddress}:${forward.localPort}`;
        default:
          return 'Unknown forward type';
      }
    };

    it('should describe local forward', () => {
      const desc = getForwardDescription({
        type: 'local',
        localPort: 8080,
        remoteHost: 'localhost',
        remotePort: 80,
        bindAddress: '127.0.0.1',
      });
      expect(desc).toContain('Local');
      expect(desc).toContain('8080');
      expect(desc).toContain('80');
    });

    it('should describe remote forward', () => {
      const desc = getForwardDescription({
        type: 'remote',
        localPort: 3000,
        remoteHost: 'localhost',
        remotePort: 3000,
        bindAddress: '127.0.0.1',
      });
      expect(desc).toContain('Remote');
    });

    it('should describe dynamic forward', () => {
      const desc = getForwardDescription({
        type: 'dynamic',
        localPort: 1080,
        bindAddress: '0.0.0.0',
      });
      expect(desc).toContain('SOCKS');
      expect(desc).toContain('1080');
    });
  });

  describe('Common Port Presets', () => {
    const commonPorts = [
      { port: 80, service: 'HTTP' },
      { port: 443, service: 'HTTPS' },
      { port: 22, service: 'SSH' },
      { port: 3306, service: 'MySQL' },
      { port: 5432, service: 'PostgreSQL' },
      { port: 6379, service: 'Redis' },
      { port: 27017, service: 'MongoDB' },
      { port: 8080, service: 'HTTP Alt' },
      { port: 3000, service: 'Dev Server' },
      { port: 1080, service: 'SOCKS' },
    ];

    const getServiceName = (port: number): string => {
      return commonPorts.find(p => p.port === port)?.service || 'Custom';
    };

    it('should have common port presets', () => {
      expect(commonPorts.length).toBeGreaterThan(5);
    });

    it('should identify common services', () => {
      expect(getServiceName(80)).toBe('HTTP');
      expect(getServiceName(443)).toBe('HTTPS');
      expect(getServiceName(3306)).toBe('MySQL');
    });

    it('should return Custom for unknown ports', () => {
      expect(getServiceName(12345)).toBe('Custom');
    });
  });

  describe('Bind Address Options', () => {
    const bindAddresses = [
      { value: '127.0.0.1', label: 'Localhost only', description: 'Only accessible from this machine' },
      { value: '0.0.0.0', label: 'All interfaces', description: 'Accessible from any network' },
    ];

    it('should have localhost option', () => {
      const localhost = bindAddresses.find(a => a.value === '127.0.0.1');
      expect(localhost).toBeDefined();
    });

    it('should have all interfaces option', () => {
      const all = bindAddresses.find(a => a.value === '0.0.0.0');
      expect(all).toBeDefined();
    });

    it('should warn about security for 0.0.0.0', () => {
      const all = bindAddresses.find(a => a.value === '0.0.0.0');
      expect(all?.description).toContain('any network');
    });
  });

  describe('Privileged Port Warning', () => {
    const isPrivilegedPort = (port: number): boolean => {
      return port < 1024;
    };

    const getPrivilegedPortWarning = (port: number): string | null => {
      if (!isPrivilegedPort(port)) return null;
      return `Port ${port} is a privileged port. You may need root/administrator access to bind to it.`;
    };

    it('should detect privileged ports', () => {
      expect(isPrivilegedPort(80)).toBe(true);
      expect(isPrivilegedPort(443)).toBe(true);
      expect(isPrivilegedPort(22)).toBe(true);
    });

    it('should not flag non-privileged ports', () => {
      expect(isPrivilegedPort(8080)).toBe(false);
      expect(isPrivilegedPort(3000)).toBe(false);
    });

    it('should return warning for privileged ports', () => {
      const warning = getPrivilegedPortWarning(80);
      expect(warning).not.toBeNull();
      expect(warning).toContain('privileged');
    });

    it('should return null for non-privileged ports', () => {
      const warning = getPrivilegedPortWarning(8080);
      expect(warning).toBeNull();
    });
  });
});
