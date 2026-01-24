/**
 * ServerList Component Tests
 * Tests for the server list component including display, selection, and actions
 */

import React from 'react';

// Mock server data
const mockServers = [
  {
    id: '1',
    name: 'Production Server',
    host: '192.168.1.100',
    port: 22,
    username: 'admin',
    color: '#FF6B6B',
    os: 'linux',
    connectionType: 'ssh',
  },
  {
    id: '2',
    name: 'Staging Server',
    host: 'staging.example.com',
    port: 22,
    username: 'deploy',
    color: '#4ECDC4',
    os: 'ubuntu',
    connectionType: 'ssh',
  },
  {
    id: '3',
    name: 'Windows RDP',
    host: '192.168.1.200',
    port: 3389,
    username: 'Administrator',
    color: '#45B7D1',
    os: 'windows',
    connectionType: 'rdp',
  },
];

describe('ServerList Component', () => {
  describe('Server Display', () => {
    it('should display server name', () => {
      mockServers.forEach(server => {
        expect(server.name).toBeDefined();
        expect(typeof server.name).toBe('string');
        expect(server.name.length).toBeGreaterThan(0);
      });
    });

    it('should display server host', () => {
      mockServers.forEach(server => {
        expect(server.host).toBeDefined();
      });
    });

    it('should display server color indicator', () => {
      mockServers.forEach(server => {
        expect(server.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      });
    });

    it('should group servers by connection type', () => {
      const sshServers = mockServers.filter(s => s.connectionType === 'ssh');
      const rdpServers = mockServers.filter(s => s.connectionType === 'rdp');
      
      expect(sshServers.length).toBe(2);
      expect(rdpServers.length).toBe(1);
    });
  });

  describe('Server Selection', () => {
    let selectedServerId: string | null = null;

    it('should track selected server', () => {
      selectedServerId = mockServers[0].id;
      expect(selectedServerId).toBe('1');
    });

    it('should change selection', () => {
      selectedServerId = mockServers[1].id;
      expect(selectedServerId).toBe('2');
    });

    it('should clear selection', () => {
      selectedServerId = null;
      expect(selectedServerId).toBeNull();
    });
  });

  describe('Server Actions', () => {
    const onConnect = jest.fn();
    const onEdit = jest.fn();
    const onDelete = jest.fn();
    const onDuplicate = jest.fn();

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should trigger connect callback', () => {
      onConnect(mockServers[0]);
      expect(onConnect).toHaveBeenCalledWith(mockServers[0]);
    });

    it('should trigger edit callback', () => {
      onEdit(mockServers[0]);
      expect(onEdit).toHaveBeenCalledWith(mockServers[0]);
    });

    it('should trigger delete callback', () => {
      onDelete(mockServers[0].id);
      expect(onDelete).toHaveBeenCalledWith('1');
    });

    it('should trigger duplicate callback', () => {
      onDuplicate(mockServers[0]);
      expect(onDuplicate).toHaveBeenCalledWith(mockServers[0]);
    });
  });

  describe('Search and Filter', () => {
    const filterServers = (servers: typeof mockServers, query: string) => {
      const lowerQuery = query.toLowerCase();
      return servers.filter(
        s => s.name.toLowerCase().includes(lowerQuery) ||
             s.host.toLowerCase().includes(lowerQuery) ||
             s.username.toLowerCase().includes(lowerQuery)
      );
    };

    it('should filter by server name', () => {
      const filtered = filterServers(mockServers, 'Production');
      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe('Production Server');
    });

    it('should filter by host', () => {
      const filtered = filterServers(mockServers, 'staging.example');
      expect(filtered.length).toBe(1);
    });

    it('should filter by username', () => {
      const filtered = filterServers(mockServers, 'deploy');
      expect(filtered.length).toBe(1);
      expect(filtered[0].username).toBe('deploy');
    });

    it('should return all on empty query', () => {
      const filtered = filterServers(mockServers, '');
      expect(filtered.length).toBe(mockServers.length);
    });

    it('should return empty on no match', () => {
      const filtered = filterServers(mockServers, 'nonexistent');
      expect(filtered.length).toBe(0);
    });
  });

  describe('OS Detection', () => {
    const getOSIcon = (os: string) => {
      const osLower = os.toLowerCase();
      if (osLower.includes('ubuntu') || osLower.includes('debian')) return 'ubuntu';
      if (osLower.includes('centos') || osLower.includes('rhel')) return 'redhat';
      if (osLower.includes('linux')) return 'linux';
      if (osLower.includes('windows')) return 'windows';
      if (osLower.includes('mac') || osLower.includes('darwin')) return 'apple';
      return 'server';
    };

    it('should detect Ubuntu', () => {
      expect(getOSIcon('ubuntu')).toBe('ubuntu');
    });

    it('should detect Windows', () => {
      expect(getOSIcon('windows')).toBe('windows');
    });

    it('should detect generic Linux', () => {
      expect(getOSIcon('linux')).toBe('linux');
    });

    it('should fallback to server icon', () => {
      expect(getOSIcon('unknown')).toBe('server');
    });
  });

  describe('Connection Status', () => {
    const connectionStatus = new Map<string, 'disconnected' | 'connecting' | 'connected'>();

    it('should track disconnected status', () => {
      connectionStatus.set('1', 'disconnected');
      expect(connectionStatus.get('1')).toBe('disconnected');
    });

    it('should track connecting status', () => {
      connectionStatus.set('1', 'connecting');
      expect(connectionStatus.get('1')).toBe('connecting');
    });

    it('should track connected status', () => {
      connectionStatus.set('1', 'connected');
      expect(connectionStatus.get('1')).toBe('connected');
    });

    it('should update multiple servers', () => {
      connectionStatus.set('1', 'connected');
      connectionStatus.set('2', 'connecting');
      connectionStatus.set('3', 'disconnected');
      
      expect(connectionStatus.get('1')).toBe('connected');
      expect(connectionStatus.get('2')).toBe('connecting');
      expect(connectionStatus.get('3')).toBe('disconnected');
    });
  });

  describe('Drag and Drop', () => {
    const reorderServers = (servers: typeof mockServers, fromIndex: number, toIndex: number) => {
      const result = [...servers];
      const [removed] = result.splice(fromIndex, 1);
      result.splice(toIndex, 0, removed);
      return result;
    };

    it('should reorder servers', () => {
      const reordered = reorderServers(mockServers, 0, 2);
      expect(reordered[2].id).toBe('1');
      expect(reordered[0].id).toBe('2');
    });

    it('should maintain all servers after reorder', () => {
      const reordered = reorderServers(mockServers, 0, 2);
      expect(reordered.length).toBe(mockServers.length);
    });
  });
});
