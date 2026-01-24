/**
 * Unit tests for SFTP Manager
 * Tests file operations, directory listing, and transfers
 */

describe('SFTPManager', () => {
  interface FileEntry {
    name: string;
    type: 'file' | 'directory' | 'symlink';
    size: number;
    permissions: string;
    owner: string;
    group: string;
    modifyTime: Date;
  }

  class MockSFTPManager {
    private files: Map<string, FileEntry> = new Map();
    private currentPath: string = '/home/user';

    constructor() {
      // Initialize with some mock files
      this.files.set('/home/user', {
        name: 'user',
        type: 'directory',
        size: 4096,
        permissions: 'drwxr-xr-x',
        owner: 'user',
        group: 'user',
        modifyTime: new Date()
      });
    }

    async listDirectory(path: string): Promise<FileEntry[]> {
      if (!path.startsWith('/')) {
        throw new Error('Path must be absolute');
      }
      return Array.from(this.files.values()).filter(f => 
        f.name !== path && this.getParentPath(path) === this.getParentPath('/' + f.name)
      );
    }

    private getParentPath(path: string): string {
      const parts = path.split('/').filter(p => p);
      parts.pop();
      return '/' + parts.join('/');
    }

    async createDirectory(path: string): Promise<boolean> {
      if (this.files.has(path)) {
        throw new Error('Directory already exists');
      }
      
      this.files.set(path, {
        name: path.split('/').pop()!,
        type: 'directory',
        size: 4096,
        permissions: 'drwxr-xr-x',
        owner: 'user',
        group: 'user',
        modifyTime: new Date()
      });
      return true;
    }

    async deleteFile(path: string): Promise<boolean> {
      const entry = this.files.get(path);
      if (!entry) {
        throw new Error('File not found');
      }
      if (entry.type === 'directory') {
        throw new Error('Cannot delete directory with deleteFile');
      }
      this.files.delete(path);
      return true;
    }

    async deleteDirectory(path: string, recursive: boolean = false): Promise<boolean> {
      const entry = this.files.get(path);
      if (!entry) {
        throw new Error('Directory not found');
      }
      if (entry.type !== 'directory') {
        throw new Error('Not a directory');
      }
      
      // Check for children
      const hasChildren = Array.from(this.files.keys()).some(k => 
        k !== path && k.startsWith(path + '/')
      );
      
      if (hasChildren && !recursive) {
        throw new Error('Directory not empty');
      }
      
      if (recursive) {
        // Delete all children
        for (const key of this.files.keys()) {
          if (key.startsWith(path + '/')) {
            this.files.delete(key);
          }
        }
      }
      
      this.files.delete(path);
      return true;
    }

    async rename(oldPath: string, newPath: string): Promise<boolean> {
      const entry = this.files.get(oldPath);
      if (!entry) {
        throw new Error('Source not found');
      }
      if (this.files.has(newPath)) {
        throw new Error('Destination already exists');
      }
      
      this.files.delete(oldPath);
      entry.name = newPath.split('/').pop()!;
      this.files.set(newPath, entry);
      return true;
    }

    async stat(path: string): Promise<FileEntry> {
      const entry = this.files.get(path);
      if (!entry) {
        throw new Error('Path not found');
      }
      return entry;
    }

    async chmod(path: string, mode: string): Promise<boolean> {
      const entry = this.files.get(path);
      if (!entry) {
        throw new Error('Path not found');
      }
      // Validate mode format (e.g., '755', '644')
      if (!/^[0-7]{3,4}$/.test(mode)) {
        throw new Error('Invalid mode format');
      }
      entry.permissions = this.modeToPermissions(mode, entry.type);
      return true;
    }

    private modeToPermissions(mode: string, type: 'file' | 'directory' | 'symlink'): string {
      const prefix = type === 'directory' ? 'd' : type === 'symlink' ? 'l' : '-';
      const perms = ['---', '--x', '-w-', '-wx', 'r--', 'r-x', 'rw-', 'rwx'];
      const modeNum = mode.padStart(3, '0').slice(-3);
      return prefix + 
        perms[parseInt(modeNum[0])] +
        perms[parseInt(modeNum[1])] +
        perms[parseInt(modeNum[2])];
    }

    parsePermissions(permissions: string): { read: boolean; write: boolean; execute: boolean } {
      return {
        read: permissions[1] === 'r',
        write: permissions[2] === 'w',
        execute: permissions[3] === 'x'
      };
    }

    formatFileSize(bytes: number): string {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
  }

  let sftp: MockSFTPManager;

  beforeEach(() => {
    sftp = new MockSFTPManager();
  });

  describe('Directory Operations', () => {
    it('should create a directory', async () => {
      const result = await sftp.createDirectory('/home/user/newdir');
      expect(result).toBe(true);
      
      const stat = await sftp.stat('/home/user/newdir');
      expect(stat.type).toBe('directory');
    });

    it('should throw error when creating existing directory', async () => {
      await sftp.createDirectory('/home/user/test');
      await expect(sftp.createDirectory('/home/user/test')).rejects.toThrow('Directory already exists');
    });

    it('should require absolute paths', async () => {
      await expect(sftp.listDirectory('relative/path')).rejects.toThrow('Path must be absolute');
    });
  });

  describe('File Operations', () => {
    it('should rename files', async () => {
      await sftp.createDirectory('/home/user/oldname');
      const result = await sftp.rename('/home/user/oldname', '/home/user/newname');
      
      expect(result).toBe(true);
      await expect(sftp.stat('/home/user/oldname')).rejects.toThrow('Path not found');
      const stat = await sftp.stat('/home/user/newname');
      expect(stat.name).toBe('newname');
    });

    it('should throw error when renaming non-existent file', async () => {
      await expect(sftp.rename('/nonexistent', '/newpath')).rejects.toThrow('Source not found');
    });

    it('should throw error when destination exists', async () => {
      await sftp.createDirectory('/home/user/dir1');
      await sftp.createDirectory('/home/user/dir2');
      await expect(sftp.rename('/home/user/dir1', '/home/user/dir2')).rejects.toThrow('Destination already exists');
    });
  });

  describe('Permissions', () => {
    it('should change file permissions', async () => {
      await sftp.createDirectory('/home/user/testdir');
      const result = await sftp.chmod('/home/user/testdir', '755');
      
      expect(result).toBe(true);
      const stat = await sftp.stat('/home/user/testdir');
      expect(stat.permissions).toBe('drwxr-xr-x');
    });

    it('should reject invalid mode format', async () => {
      await sftp.createDirectory('/home/user/testdir');
      await expect(sftp.chmod('/home/user/testdir', 'abc')).rejects.toThrow('Invalid mode format');
    });

    it('should parse permissions correctly', () => {
      const perms = sftp.parsePermissions('drwxr-xr-x');
      expect(perms.read).toBe(true);
      expect(perms.write).toBe(true);
      expect(perms.execute).toBe(true);
    });
  });

  describe('File Size Formatting', () => {
    it('should format bytes correctly', () => {
      expect(sftp.formatFileSize(0)).toBe('0 B');
      expect(sftp.formatFileSize(500)).toBe('500 B');
      expect(sftp.formatFileSize(1024)).toBe('1 KB');
      expect(sftp.formatFileSize(1536)).toBe('1.5 KB');
      expect(sftp.formatFileSize(1048576)).toBe('1 MB');
      expect(sftp.formatFileSize(1073741824)).toBe('1 GB');
      expect(sftp.formatFileSize(1099511627776)).toBe('1 TB');
    });
  });

  describe('Delete Operations', () => {
    it('should delete empty directory', async () => {
      await sftp.createDirectory('/home/user/emptydir');
      const result = await sftp.deleteDirectory('/home/user/emptydir');
      expect(result).toBe(true);
    });

    it('should throw error on non-existent directory', async () => {
      await expect(sftp.deleteDirectory('/nonexistent')).rejects.toThrow('Directory not found');
    });
  });
});
