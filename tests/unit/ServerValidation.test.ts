/**
 * Unit tests for Server validation and management
 */

describe('Server Validation', () => {
  // Validation functions
  const validateServerName = (name: string): boolean => {
    return name.length > 0 && name.length <= 100;
  };

  const validateHost = (host: string): boolean => {
    // Basic host validation (IP or hostname)
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/;
    return ipRegex.test(host) || hostnameRegex.test(host);
  };

  const validatePort = (port: number): boolean => {
    return Number.isInteger(port) && port > 0 && port <= 65535;
  };

  const validateUsername = (username: string): boolean => {
    return username.length > 0 && username.length <= 32 && /^[a-zA-Z0-9_-]+$/.test(username);
  };

  describe('Server Name Validation', () => {
    it('should accept valid server names', () => {
      expect(validateServerName('My Server')).toBe(true);
      expect(validateServerName('Production-01')).toBe(true);
      expect(validateServerName('a')).toBe(true);
    });

    it('should reject empty server names', () => {
      expect(validateServerName('')).toBe(false);
    });

    it('should reject names exceeding 100 characters', () => {
      const longName = 'a'.repeat(101);
      expect(validateServerName(longName)).toBe(false);
    });
  });

  describe('Host Validation', () => {
    it('should accept valid IP addresses', () => {
      expect(validateHost('192.168.1.1')).toBe(true);
      expect(validateHost('10.0.0.1')).toBe(true);
      expect(validateHost('255.255.255.255')).toBe(true);
    });

    it('should accept valid hostnames', () => {
      expect(validateHost('example.com')).toBe(true);
      expect(validateHost('server-01.example.com')).toBe(true);
      expect(validateHost('localhost')).toBe(true);
    });

    it('should reject invalid hosts', () => {
      expect(validateHost('')).toBe(false);
      expect(validateHost('-invalid.com')).toBe(false);
      expect(validateHost('invalid-.com')).toBe(false);
    });
  });

  describe('Port Validation', () => {
    it('should accept valid ports', () => {
      expect(validatePort(22)).toBe(true);
      expect(validatePort(80)).toBe(true);
      expect(validatePort(443)).toBe(true);
      expect(validatePort(8080)).toBe(true);
      expect(validatePort(65535)).toBe(true);
    });

    it('should reject invalid ports', () => {
      expect(validatePort(0)).toBe(false);
      expect(validatePort(-1)).toBe(false);
      expect(validatePort(65536)).toBe(false);
      expect(validatePort(1.5)).toBe(false);
    });
  });

  describe('Username Validation', () => {
    it('should accept valid usernames', () => {
      expect(validateUsername('root')).toBe(true);
      expect(validateUsername('admin')).toBe(true);
      expect(validateUsername('user_01')).toBe(true);
      expect(validateUsername('test-user')).toBe(true);
    });

    it('should reject invalid usernames', () => {
      expect(validateUsername('')).toBe(false);
      expect(validateUsername('user name')).toBe(false); // no spaces
      expect(validateUsername('user@domain')).toBe(false); // no @
    });
  });
});

describe('Server Color Assignment', () => {
  const serverColors = [
    '#ef4444', // red
    '#f97316', // orange
    '#eab308', // yellow
    '#22c55e', // green
    '#14b8a6', // teal
    '#3b82f6', // blue
    '#8b5cf6', // violet
    '#ec4899', // pink
  ];

  const getColorForServer = (index: number): string => {
    return serverColors[index % serverColors.length];
  };

  it('should assign colors cyclically', () => {
    expect(getColorForServer(0)).toBe('#ef4444');
    expect(getColorForServer(1)).toBe('#f97316');
    expect(getColorForServer(8)).toBe('#ef4444'); // Wraps around
  });

  it('should provide consistent colors for same index', () => {
    const color1 = getColorForServer(5);
    const color2 = getColorForServer(5);
    expect(color1).toBe(color2);
  });
});

describe('Server OS Detection', () => {
  const detectOS = (osInfo: string): 'linux' | 'windows' | 'macos' | 'unknown' => {
    const lower = osInfo.toLowerCase();
    if (lower.includes('linux') || lower.includes('ubuntu') || lower.includes('debian') || lower.includes('centos') || lower.includes('fedora')) {
      return 'linux';
    }
    if (lower.includes('windows')) {
      return 'windows';
    }
    if (lower.includes('darwin') || lower.includes('macos') || lower.includes('mac os')) {
      return 'macos';
    }
    return 'unknown';
  };

  it('should detect Linux variants', () => {
    expect(detectOS('Linux 5.4.0')).toBe('linux');
    expect(detectOS('Ubuntu 22.04')).toBe('linux');
    expect(detectOS('Debian 11')).toBe('linux');
    expect(detectOS('CentOS 8')).toBe('linux');
  });

  it('should detect Windows', () => {
    expect(detectOS('Windows Server 2019')).toBe('windows');
    expect(detectOS('Windows 10')).toBe('windows');
  });

  it('should detect macOS', () => {
    expect(detectOS('Darwin 21.0')).toBe('macos');
    expect(detectOS('macOS Monterey')).toBe('macos');
  });

  it('should return unknown for unrecognized OS', () => {
    expect(detectOS('FreeBSD 13')).toBe('unknown');
    expect(detectOS('')).toBe('unknown');
  });
});
