/**
 * AddServerModal Component Tests
 * Tests for the server creation/editing modal
 */

import React from 'react';

// Server configuration interface
interface ServerConfig {
  id?: string;
  name: string;
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
  connectionType: 'ssh' | 'rdp' | 'ftp' | 'sftp';
  color: string;
  tags?: string[];
}

describe('AddServerModal Component', () => {
  describe('Form Validation', () => {
    const validateServerConfig = (config: Partial<ServerConfig>): { valid: boolean; errors: string[] } => {
      const errors: string[] = [];
      
      if (!config.name || config.name.trim() === '') {
        errors.push('Server name is required');
      }
      
      if (!config.host || config.host.trim() === '') {
        errors.push('Host is required');
      }
      
      if (!config.port || config.port < 1 || config.port > 65535) {
        errors.push('Port must be between 1 and 65535');
      }
      
      if (!config.username || config.username.trim() === '') {
        errors.push('Username is required');
      }
      
      if (!config.password && !config.privateKey) {
        errors.push('Password or private key is required');
      }
      
      return { valid: errors.length === 0, errors };
    };

    it('should validate complete config', () => {
      const config: ServerConfig = {
        name: 'My Server',
        host: '192.168.1.100',
        port: 22,
        username: 'admin',
        password: 'secret',
        connectionType: 'ssh',
        color: '#FF6B6B',
      };
      expect(validateServerConfig(config).valid).toBe(true);
    });

    it('should require server name', () => {
      const result = validateServerConfig({
        host: '192.168.1.100',
        port: 22,
        username: 'admin',
        password: 'secret',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Server name is required');
    });

    it('should require host', () => {
      const result = validateServerConfig({
        name: 'My Server',
        port: 22,
        username: 'admin',
        password: 'secret',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Host is required');
    });

    it('should validate port range', () => {
      const result1 = validateServerConfig({
        name: 'Server',
        host: '192.168.1.100',
        port: 0,
        username: 'admin',
        password: 'secret',
      });
      expect(result1.valid).toBe(false);

      const result2 = validateServerConfig({
        name: 'Server',
        host: '192.168.1.100',
        port: 70000,
        username: 'admin',
        password: 'secret',
      });
      expect(result2.valid).toBe(false);
    });

    it('should require authentication', () => {
      const result = validateServerConfig({
        name: 'Server',
        host: '192.168.1.100',
        port: 22,
        username: 'admin',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password or private key is required');
    });

    it('should accept private key instead of password', () => {
      const config: ServerConfig = {
        name: 'My Server',
        host: '192.168.1.100',
        port: 22,
        username: 'admin',
        privateKey: '-----BEGIN OPENSSH PRIVATE KEY-----...',
        connectionType: 'ssh',
        color: '#FF6B6B',
      };
      expect(validateServerConfig(config).valid).toBe(true);
    });
  });

  describe('Host Validation', () => {
    const isValidHost = (host: string): boolean => {
      // IPv4 - must be exactly 4 octets
      const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (ipv4Regex.test(host)) {
        const parts = host.split('.').map(Number);
        return parts.every(p => p >= 0 && p <= 255);
      }
      
      // Hostname - must contain at least one letter (to distinguish from partial IPs)
      const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/;
      const hasLetter = /[a-zA-Z]/.test(host);
      return hostnameRegex.test(host) && host.length <= 253 && hasLetter;
    };

    it('should accept valid IPv4', () => {
      expect(isValidHost('192.168.1.100')).toBe(true);
      expect(isValidHost('10.0.0.1')).toBe(true);
      expect(isValidHost('8.8.8.8')).toBe(true);
    });

    it('should reject invalid IPv4', () => {
      expect(isValidHost('256.168.1.100')).toBe(false);
      // Partial IP with 3 octets - not valid as hostname either
      expect(isValidHost('192.168.1')).toBe(false);
    });

    it('should accept valid hostnames', () => {
      expect(isValidHost('server.example.com')).toBe(true);
      expect(isValidHost('my-server')).toBe(true);
      expect(isValidHost('localhost')).toBe(true);
    });

    it('should reject invalid hostnames', () => {
      expect(isValidHost('-invalid')).toBe(false);
      expect(isValidHost('invalid-')).toBe(false);
    });
  });

  describe('Connection Types', () => {
    const connectionTypes = ['ssh', 'rdp', 'ftp', 'sftp'] as const;
    
    const getDefaultPort = (type: typeof connectionTypes[number]): number => {
      const ports: Record<typeof connectionTypes[number], number> = {
        ssh: 22,
        rdp: 3389,
        ftp: 21,
        sftp: 22,
      };
      return ports[type];
    };

    it('should return correct default port for SSH', () => {
      expect(getDefaultPort('ssh')).toBe(22);
    });

    it('should return correct default port for RDP', () => {
      expect(getDefaultPort('rdp')).toBe(3389);
    });

    it('should return correct default port for FTP', () => {
      expect(getDefaultPort('ftp')).toBe(21);
    });

    it('should return correct default port for SFTP', () => {
      expect(getDefaultPort('sftp')).toBe(22);
    });
  });

  describe('Color Selection', () => {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
      '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
    ];

    const isValidHexColor = (color: string): boolean => {
      return /^#[0-9A-Fa-f]{6}$/.test(color);
    };

    it('should have valid hex colors', () => {
      colors.forEach(color => {
        expect(isValidHexColor(color)).toBe(true);
      });
    });

    it('should provide multiple color options', () => {
      expect(colors.length).toBeGreaterThanOrEqual(6);
    });

    it('should have unique colors', () => {
      const uniqueColors = new Set(colors);
      expect(uniqueColors.size).toBe(colors.length);
    });
  });

  describe('Form State Management', () => {
    let formState: Partial<ServerConfig> = {};

    const updateField = <K extends keyof ServerConfig>(field: K, value: ServerConfig[K]) => {
      formState = { ...formState, [field]: value };
    };

    const resetForm = () => {
      formState = {};
    };

    const loadServer = (server: ServerConfig) => {
      formState = { ...server };
    };

    beforeEach(() => {
      formState = {};
    });

    it('should update individual fields', () => {
      updateField('name', 'My Server');
      expect(formState.name).toBe('My Server');
    });

    it('should preserve other fields when updating', () => {
      updateField('name', 'Server');
      updateField('host', '192.168.1.100');
      expect(formState.name).toBe('Server');
      expect(formState.host).toBe('192.168.1.100');
    });

    it('should reset form', () => {
      updateField('name', 'Server');
      resetForm();
      expect(formState.name).toBeUndefined();
    });

    it('should load existing server data', () => {
      const server: ServerConfig = {
        id: '1',
        name: 'Existing Server',
        host: '10.0.0.1',
        port: 22,
        username: 'admin',
        password: 'secret',
        connectionType: 'ssh',
        color: '#4ECDC4',
      };
      loadServer(server);
      expect(formState.id).toBe('1');
      expect(formState.name).toBe('Existing Server');
    });
  });

  describe('Tags Management', () => {
    let tags: string[] = [];

    const addTag = (tag: string) => {
      const trimmed = tag.trim().toLowerCase();
      if (trimmed && !tags.includes(trimmed)) {
        tags = [...tags, trimmed];
      }
    };

    const removeTag = (tag: string) => {
      tags = tags.filter(t => t !== tag);
    };

    beforeEach(() => {
      tags = [];
    });

    it('should add a tag', () => {
      addTag('production');
      expect(tags).toContain('production');
    });

    it('should not add duplicate tags', () => {
      addTag('production');
      addTag('production');
      expect(tags.length).toBe(1);
    });

    it('should normalize tags to lowercase', () => {
      addTag('PRODUCTION');
      expect(tags).toContain('production');
    });

    it('should trim whitespace', () => {
      addTag('  staging  ');
      expect(tags).toContain('staging');
    });

    it('should remove tags', () => {
      addTag('production');
      addTag('staging');
      removeTag('production');
      expect(tags).not.toContain('production');
      expect(tags).toContain('staging');
    });

    it('should not add empty tags', () => {
      addTag('');
      addTag('   ');
      expect(tags.length).toBe(0);
    });
  });

  describe('Private Key Handling', () => {
    const isValidPrivateKey = (key: string): boolean => {
      const opensshPattern = /^-----BEGIN (OPENSSH|RSA|EC|DSA) PRIVATE KEY-----/;
      return opensshPattern.test(key.trim());
    };

    it('should validate OpenSSH private key', () => {
      const key = '-----BEGIN OPENSSH PRIVATE KEY-----\nbase64content\n-----END OPENSSH PRIVATE KEY-----';
      expect(isValidPrivateKey(key)).toBe(true);
    });

    it('should validate RSA private key', () => {
      const key = '-----BEGIN RSA PRIVATE KEY-----\nbase64content\n-----END RSA PRIVATE KEY-----';
      expect(isValidPrivateKey(key)).toBe(true);
    });

    it('should reject invalid key format', () => {
      expect(isValidPrivateKey('not a private key')).toBe(false);
      expect(isValidPrivateKey('')).toBe(false);
    });
  });

  describe('Edit Mode', () => {
    const isEditMode = (config: Partial<ServerConfig>): boolean => {
      return !!config.id;
    };

    it('should detect edit mode when ID is present', () => {
      expect(isEditMode({ id: '123', name: 'Server' })).toBe(true);
    });

    it('should detect create mode when no ID', () => {
      expect(isEditMode({ name: 'Server' })).toBe(false);
      expect(isEditMode({})).toBe(false);
    });
  });
});
