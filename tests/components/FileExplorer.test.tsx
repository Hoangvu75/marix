/**
 * FileExplorer Component Tests
 * Tests for SFTP file explorer functionality
 */

import React from 'react';

// Mock file/directory data
interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  permissions: string;
  modifiedTime: Date;
  owner: string;
  group: string;
}

const mockFiles: FileEntry[] = [
  {
    name: '..',
    path: '/home',
    isDirectory: true,
    size: 4096,
    permissions: 'drwxr-xr-x',
    modifiedTime: new Date('2024-01-15'),
    owner: 'root',
    group: 'root',
  },
  {
    name: 'Documents',
    path: '/home/user/Documents',
    isDirectory: true,
    size: 4096,
    permissions: 'drwxr-xr-x',
    modifiedTime: new Date('2024-01-20'),
    owner: 'user',
    group: 'user',
  },
  {
    name: 'config.json',
    path: '/home/user/config.json',
    isDirectory: false,
    size: 1024,
    permissions: '-rw-r--r--',
    modifiedTime: new Date('2024-01-18'),
    owner: 'user',
    group: 'user',
  },
  {
    name: 'script.sh',
    path: '/home/user/script.sh',
    isDirectory: false,
    size: 512,
    permissions: '-rwxr-xr-x',
    modifiedTime: new Date('2024-01-19'),
    owner: 'user',
    group: 'user',
  },
  {
    name: 'large_file.zip',
    path: '/home/user/large_file.zip',
    isDirectory: false,
    size: 1073741824, // 1GB
    permissions: '-rw-r--r--',
    modifiedTime: new Date('2024-01-10'),
    owner: 'user',
    group: 'user',
  },
];

describe('FileExplorer Component', () => {
  describe('File Display', () => {
    it('should distinguish files from directories', () => {
      const directories = mockFiles.filter(f => f.isDirectory);
      const files = mockFiles.filter(f => !f.isDirectory);
      
      expect(directories.length).toBe(2);
      expect(files.length).toBe(3);
    });

    it('should display file names', () => {
      mockFiles.forEach(file => {
        expect(file.name).toBeDefined();
        expect(typeof file.name).toBe('string');
      });
    });

    it('should display permissions', () => {
      mockFiles.forEach(file => {
        expect(file.permissions).toMatch(/^[d-][rwx-]{9}$/);
      });
    });
  });

  describe('File Size Formatting', () => {
    const formatSize = (bytes: number): string => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    it('should format bytes correctly', () => {
      expect(formatSize(512)).toBe('512 B');
    });

    it('should format kilobytes correctly', () => {
      expect(formatSize(1024)).toBe('1 KB');
    });

    it('should format megabytes correctly', () => {
      expect(formatSize(1048576)).toBe('1 MB');
    });

    it('should format gigabytes correctly', () => {
      expect(formatSize(1073741824)).toBe('1 GB');
    });

    it('should handle zero bytes', () => {
      expect(formatSize(0)).toBe('0 B');
    });
  });

  describe('Navigation', () => {
    let currentPath = '/home/user';
    const history: string[] = ['/home/user'];
    let historyIndex = 0;

    const navigateTo = (path: string) => {
      // Remove forward history if navigating to new path
      history.splice(historyIndex + 1);
      history.push(path);
      historyIndex = history.length - 1;
      currentPath = path;
    };

    const goBack = () => {
      if (historyIndex > 0) {
        historyIndex--;
        currentPath = history[historyIndex];
        return true;
      }
      return false;
    };

    const goForward = () => {
      if (historyIndex < history.length - 1) {
        historyIndex++;
        currentPath = history[historyIndex];
        return true;
      }
      return false;
    };

    beforeEach(() => {
      currentPath = '/home/user';
      history.length = 0;
      history.push('/home/user');
      historyIndex = 0;
    });

    it('should navigate to directory', () => {
      navigateTo('/home/user/Documents');
      expect(currentPath).toBe('/home/user/Documents');
    });

    it('should go back in history', () => {
      navigateTo('/home/user/Documents');
      navigateTo('/home/user/Documents/subfolder');
      goBack();
      expect(currentPath).toBe('/home/user/Documents');
    });

    it('should go forward in history', () => {
      navigateTo('/home/user/Documents');
      goBack();
      goForward();
      expect(currentPath).toBe('/home/user/Documents');
    });

    it('should not go back beyond start', () => {
      const result = goBack();
      expect(result).toBe(false);
      expect(currentPath).toBe('/home/user');
    });

    it('should navigate to parent directory', () => {
      navigateTo('/home');
      expect(currentPath).toBe('/home');
    });
  });

  describe('Sorting', () => {
    type SortKey = 'name' | 'size' | 'modifiedTime';
    type SortOrder = 'asc' | 'desc';

    const sortFiles = (files: FileEntry[], key: SortKey, order: SortOrder): FileEntry[] => {
      return [...files].sort((a, b) => {
        // Directories first
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        
        let comparison = 0;
        if (key === 'name') {
          comparison = a.name.localeCompare(b.name);
        } else if (key === 'size') {
          comparison = a.size - b.size;
        } else if (key === 'modifiedTime') {
          comparison = a.modifiedTime.getTime() - b.modifiedTime.getTime();
        }
        
        return order === 'asc' ? comparison : -comparison;
      });
    };

    it('should sort by name ascending', () => {
      const sorted = sortFiles(mockFiles, 'name', 'asc');
      // Directories first, then files
      expect(sorted[0].name).toBe('..');
      expect(sorted[1].name).toBe('Documents');
    });

    it('should sort by name descending', () => {
      const sorted = sortFiles(mockFiles, 'name', 'desc');
      // Still directories first
      expect(sorted[0].isDirectory).toBe(true);
    });

    it('should sort by size', () => {
      const filesOnly = mockFiles.filter(f => !f.isDirectory);
      const sorted = sortFiles(filesOnly, 'size', 'asc');
      expect(sorted[0].size).toBeLessThanOrEqual(sorted[sorted.length - 1].size);
    });

    it('should keep directories before files', () => {
      const sorted = sortFiles(mockFiles, 'size', 'asc');
      const firstFileIndex = sorted.findIndex(f => !f.isDirectory);
      const lastDirIndex = sorted.map((f, i) => f.isDirectory ? i : -1).filter(i => i >= 0).pop() ?? -1;
      expect(firstFileIndex).toBeGreaterThan(lastDirIndex);
    });
  });

  describe('Selection', () => {
    let selectedFiles: Set<string> = new Set();

    const selectFile = (path: string) => {
      selectedFiles.add(path);
    };

    const deselectFile = (path: string) => {
      selectedFiles.delete(path);
    };

    const toggleSelection = (path: string) => {
      if (selectedFiles.has(path)) {
        selectedFiles.delete(path);
      } else {
        selectedFiles.add(path);
      }
    };

    const selectAll = (files: FileEntry[]) => {
      files.forEach(f => selectedFiles.add(f.path));
    };

    const clearSelection = () => {
      selectedFiles.clear();
    };

    beforeEach(() => {
      selectedFiles = new Set();
    });

    it('should select a file', () => {
      selectFile('/home/user/config.json');
      expect(selectedFiles.has('/home/user/config.json')).toBe(true);
    });

    it('should select multiple files', () => {
      selectFile('/home/user/config.json');
      selectFile('/home/user/script.sh');
      expect(selectedFiles.size).toBe(2);
    });

    it('should deselect a file', () => {
      selectFile('/home/user/config.json');
      deselectFile('/home/user/config.json');
      expect(selectedFiles.has('/home/user/config.json')).toBe(false);
    });

    it('should toggle selection', () => {
      toggleSelection('/home/user/config.json');
      expect(selectedFiles.has('/home/user/config.json')).toBe(true);
      toggleSelection('/home/user/config.json');
      expect(selectedFiles.has('/home/user/config.json')).toBe(false);
    });

    it('should select all files', () => {
      selectAll(mockFiles);
      expect(selectedFiles.size).toBe(mockFiles.length);
    });

    it('should clear selection', () => {
      selectAll(mockFiles);
      clearSelection();
      expect(selectedFiles.size).toBe(0);
    });
  });

  describe('File Operations', () => {
    const validateFileName = (name: string): { valid: boolean; error?: string } => {
      if (!name || name.trim() === '') {
        return { valid: false, error: 'Name cannot be empty' };
      }
      if (name.includes('/') || name.includes('\\')) {
        return { valid: false, error: 'Name cannot contain path separators' };
      }
      if (name === '.' || name === '..') {
        return { valid: false, error: 'Invalid file name' };
      }
      if (name.length > 255) {
        return { valid: false, error: 'Name too long' };
      }
      return { valid: true };
    };

    it('should validate valid file names', () => {
      expect(validateFileName('document.txt').valid).toBe(true);
      expect(validateFileName('my-file_v2.js').valid).toBe(true);
      expect(validateFileName('.gitignore').valid).toBe(true);
    });

    it('should reject empty names', () => {
      expect(validateFileName('').valid).toBe(false);
      expect(validateFileName('  ').valid).toBe(false);
    });

    it('should reject path separators', () => {
      expect(validateFileName('path/file.txt').valid).toBe(false);
      expect(validateFileName('path\\file.txt').valid).toBe(false);
    });

    it('should reject reserved names', () => {
      expect(validateFileName('.').valid).toBe(false);
      expect(validateFileName('..').valid).toBe(false);
    });

    it('should reject names that are too long', () => {
      const longName = 'a'.repeat(256);
      expect(validateFileName(longName).valid).toBe(false);
    });
  });

  describe('File Icons', () => {
    const getFileIcon = (name: string, isDirectory: boolean): string => {
      if (isDirectory) return 'folder';
      
      const ext = name.split('.').pop()?.toLowerCase();
      const iconMap: Record<string, string> = {
        js: 'javascript',
        ts: 'typescript',
        json: 'json',
        md: 'markdown',
        txt: 'text',
        sh: 'shell',
        py: 'python',
        html: 'html',
        css: 'css',
        zip: 'archive',
        tar: 'archive',
        gz: 'archive',
        jpg: 'image',
        png: 'image',
        gif: 'image',
        mp4: 'video',
        mp3: 'audio',
      };
      
      return iconMap[ext || ''] || 'file';
    };

    it('should return folder icon for directories', () => {
      expect(getFileIcon('Documents', true)).toBe('folder');
    });

    it('should return correct icon for known extensions', () => {
      expect(getFileIcon('config.json', false)).toBe('json');
      expect(getFileIcon('script.sh', false)).toBe('shell');
      expect(getFileIcon('image.png', false)).toBe('image');
    });

    it('should return default icon for unknown extensions', () => {
      expect(getFileIcon('file.xyz', false)).toBe('file');
    });
  });

  describe('Breadcrumb Path', () => {
    const parsePath = (path: string): { name: string; path: string }[] => {
      const parts = path.split('/').filter(Boolean);
      const breadcrumbs: { name: string; path: string }[] = [{ name: '/', path: '/' }];
      
      let currentPath = '';
      for (const part of parts) {
        currentPath += '/' + part;
        breadcrumbs.push({ name: part, path: currentPath });
      }
      
      return breadcrumbs;
    };

    it('should parse root path', () => {
      const breadcrumbs = parsePath('/');
      expect(breadcrumbs.length).toBe(1);
      expect(breadcrumbs[0].name).toBe('/');
    });

    it('should parse nested path', () => {
      const breadcrumbs = parsePath('/home/user/Documents');
      expect(breadcrumbs.length).toBe(4);
      expect(breadcrumbs[1].name).toBe('home');
      expect(breadcrumbs[2].name).toBe('user');
      expect(breadcrumbs[3].name).toBe('Documents');
    });

    it('should have correct paths for each breadcrumb', () => {
      const breadcrumbs = parsePath('/home/user');
      expect(breadcrumbs[1].path).toBe('/home');
      expect(breadcrumbs[2].path).toBe('/home/user');
    });
  });
});
