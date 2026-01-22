import { Client } from 'ssh2';
import { SFTPWrapper, FileEntry } from 'ssh2';
import { BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export interface FileInfo {
  name: string;
  type: 'file' | 'directory' | 'symlink';
  size: number;
  modifyTime: number;
  accessTime: number;
  permissions: number;
  owner: number;
  group: number;
}

export class SFTPManager {
  private sftpConnections: Map<string, SFTPWrapper> = new Map();

  async connect(connectionId: string, sshClient: Client | undefined): Promise<void> {
    if (!sshClient) {
      throw new Error('SSH client not found');
    }

    return new Promise((resolve, reject) => {
      sshClient.sftp((err, sftp) => {
        if (err) {
          reject(err);
          return;
        }
        this.sftpConnections.set(connectionId, sftp);
        resolve();
      });
    });
  }

  async listFiles(connectionId: string, remotePath: string): Promise<FileInfo[]> {
    const sftp = this.sftpConnections.get(connectionId);
    if (!sftp) {
      throw new Error('SFTP connection not found');
    }

    return new Promise((resolve, reject) => {
      sftp.readdir(remotePath, (err, list) => {
        if (err) {
          reject(err);
          return;
        }

        const files: FileInfo[] = list.map((item: FileEntry) => ({
          name: item.filename,
          type: this.getFileType(item.attrs.mode),
          size: item.attrs.size,
          modifyTime: item.attrs.mtime * 1000,
          accessTime: item.attrs.atime * 1000,
          permissions: item.attrs.mode,
          owner: item.attrs.uid,
          group: item.attrs.gid,
        }));

        resolve(files);
      });
    });
  }

  async downloadFile(connectionId: string, remotePath: string, localPath: string): Promise<void> {
    const sftp = this.sftpConnections.get(connectionId);
    if (!sftp) {
      throw new Error('SFTP connection not found');
    }

    return new Promise((resolve, reject) => {
      sftp.fastGet(remotePath, localPath, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  async uploadFile(connectionId: string, localPath: string, remotePath: string): Promise<void> {
    const sftp = this.sftpConnections.get(connectionId);
    if (!sftp) {
      throw new Error('SFTP connection not found');
    }

    return new Promise((resolve, reject) => {
      sftp.fastPut(localPath, remotePath, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  async deleteFile(connectionId: string, remotePath: string): Promise<void> {
    const sftp = this.sftpConnections.get(connectionId);
    if (!sftp) {
      throw new Error('SFTP connection not found');
    }

    // First check if it's a file or directory
    const stats = await new Promise<any>((resolve, reject) => {
      sftp.stat(remotePath, (err, stats) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(stats);
      });
    });

    // If it's a directory, use deleteDirectory (with recursive support)
    if (stats.isDirectory()) {
      console.log('[SFTPManager] Target is a directory, using deleteDirectory:', remotePath);
      await this.deleteDirectory(connectionId, remotePath);
      return;
    }

    // Otherwise delete as file
    return new Promise((resolve, reject) => {
      sftp.unlink(remotePath, (err) => {
        if (err) {
          reject(err);
          return;
        }
        console.log('[SFTPManager] Deleted file:', remotePath);
        resolve();
      });
    });
  }

  async createDirectory(connectionId: string, remotePath: string): Promise<void> {
    const sftp = this.sftpConnections.get(connectionId);
    if (!sftp) {
      throw new Error('SFTP connection not found');
    }

    return new Promise((resolve, reject) => {
      sftp.mkdir(remotePath, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  async readFile(connectionId: string, remotePath: string): Promise<string> {
    const sftp = this.sftpConnections.get(connectionId);
    if (!sftp) {
      throw new Error('SFTP connection not found');
    }

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const readStream = sftp.createReadStream(remotePath);
      
      readStream.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      
      readStream.on('error', (err: Error) => reject(err));
      
      readStream.on('end', () => {
        const content = Buffer.concat(chunks).toString('utf8');
        resolve(content);
      });
    });
  }

  async writeFile(connectionId: string, remotePath: string, content: string): Promise<void> {
    const sftp = this.sftpConnections.get(connectionId);
    if (!sftp) {
      throw new Error('SFTP connection not found');
    }

    return new Promise((resolve, reject) => {
      const writeStream = sftp.createWriteStream(remotePath);
      writeStream.on('error', (err: Error) => reject(err));
      writeStream.on('close', () => resolve());
      writeStream.write(content);
      writeStream.end();
    });
  }

  async chmod(connectionId: string, remotePath: string, mode: number): Promise<void> {
    const sftp = this.sftpConnections.get(connectionId);
    if (!sftp) {
      throw new Error('SFTP connection not found');
    }

    return new Promise((resolve, reject) => {
      sftp.chmod(remotePath, mode, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  async rename(connectionId: string, oldPath: string, newPath: string): Promise<void> {
    const sftp = this.sftpConnections.get(connectionId);
    if (!sftp) {
      throw new Error('SFTP connection not found');
    }

    return new Promise((resolve, reject) => {
      sftp.rename(oldPath, newPath, (err) => {
        if (err) {
          reject(err);
          return;
        }
        console.log('[SFTPManager] Renamed:', oldPath, '->', newPath);
        resolve();
      });
    });
  }

  async deleteDirectory(connectionId: string, remotePath: string): Promise<void> {
    const sftp = this.sftpConnections.get(connectionId);
    if (!sftp) {
      throw new Error('SFTP connection not found');
    }

    // First, try to delete directly (works for empty directories)
    try {
      await new Promise<void>((resolve, reject) => {
        sftp.rmdir(remotePath, (err) => {
          if (err) {
            reject(err);
            return;
          }
          console.log('[SFTPManager] Deleted empty directory:', remotePath);
          resolve();
        });
      });
      return;
    } catch (err: any) {
      // If directory not empty, we need to delete recursively
      if (err.message?.includes('Failure') || err.code === 4) {
        console.log('[SFTPManager] Directory not empty, deleting recursively:', remotePath);
        await this.deleteDirectoryRecursive(connectionId, remotePath);
        return;
      }
      throw err;
    }
  }

  // Track delete count for progress reporting
  private deleteCount = 0;

  // Emit delete progress to renderer
  private emitDeleteProgress(connectionId: string, path: string, type: 'file' | 'directory', count: number): void {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      win.webContents.send('sftp:delete-progress', { connectionId, path, type, count });
    }
  }

  // Recursive delete for non-empty directories
  private async deleteDirectoryRecursive(connectionId: string, remotePath: string, isRoot = true): Promise<void> {
    const sftp = this.sftpConnections.get(connectionId);
    if (!sftp) {
      throw new Error('SFTP connection not found');
    }

    // Reset count on root call
    if (isRoot) {
      this.deleteCount = 0;
    }

    // List all files and directories
    const items = await this.listFiles(connectionId, remotePath);

    // Delete each item
    for (const item of items) {
      const itemPath = remotePath.endsWith('/') 
        ? `${remotePath}${item.name}` 
        : `${remotePath}/${item.name}`;

      if (item.type === 'directory') {
        // Recursively delete subdirectory
        await this.deleteDirectoryRecursive(connectionId, itemPath, false);
      } else {
        // Send progress event
        this.deleteCount++;
        this.emitDeleteProgress(connectionId, itemPath, 'file', this.deleteCount);
        
        // Delete file
        await new Promise<void>((resolve, reject) => {
          sftp.unlink(itemPath, (err) => {
            if (err) {
              console.error('[SFTPManager] Failed to delete file:', itemPath, err.message);
              reject(err);
              return;
            }
            console.log('[SFTPManager] Deleted file:', itemPath);
            resolve();
          });
        });
      }
    }

    // Send progress for directory
    this.deleteCount++;
    this.emitDeleteProgress(connectionId, remotePath, 'directory', this.deleteCount);

    // Now delete the empty directory
    await new Promise<void>((resolve, reject) => {
      sftp.rmdir(remotePath, (err) => {
        if (err) {
          console.error('[SFTPManager] Failed to delete directory:', remotePath, err.message);
          reject(err);
          return;
        }
        console.log('[SFTPManager] Deleted directory:', remotePath);
        resolve();
      });
    });
  }

  disconnect(connectionId: string): void {
    const sftp = this.sftpConnections.get(connectionId);
    if (sftp) {
      sftp.end();
      this.sftpConnections.delete(connectionId);
    }
  }

  // Transfer progress tracking
  private transferProgress = {
    totalFiles: 0,
    completedFiles: 0,
    currentFile: '',
    totalBytes: 0,
    transferredBytes: 0,
  };

  // Emit transfer progress to renderer
  private emitTransferProgress(connectionId: string, type: 'download' | 'upload'): void {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      win.webContents.send('sftp:transfer-progress', { 
        connectionId, 
        type,
        ...this.transferProgress 
      });
    }
  }

  // Count all files in a remote directory recursively
  private async countRemoteFiles(connectionId: string, remotePath: string): Promise<{ count: number; totalBytes: number }> {
    const sftp = this.sftpConnections.get(connectionId);
    if (!sftp) throw new Error('SFTP connection not found');

    let count = 0;
    let totalBytes = 0;

    const items = await this.listFiles(connectionId, remotePath);
    for (const item of items) {
      const itemPath = remotePath.endsWith('/') ? `${remotePath}${item.name}` : `${remotePath}/${item.name}`;
      if (item.type === 'directory') {
        const sub = await this.countRemoteFiles(connectionId, itemPath);
        count += sub.count;
        totalBytes += sub.totalBytes;
      } else {
        count++;
        totalBytes += item.size;
      }
    }
    return { count, totalBytes };
  }

  // Count all files in a local directory recursively
  private countLocalFiles(localPath: string): { count: number; totalBytes: number } {
    let count = 0;
    let totalBytes = 0;

    const items = fs.readdirSync(localPath, { withFileTypes: true });
    for (const item of items) {
      const itemPath = path.join(localPath, item.name);
      if (item.isDirectory()) {
        const sub = this.countLocalFiles(itemPath);
        count += sub.count;
        totalBytes += sub.totalBytes;
      } else {
        count++;
        const stat = fs.statSync(itemPath);
        totalBytes += stat.size;
      }
    }
    return { count, totalBytes };
  }

  // Download folder recursively with progress
  async downloadFolder(connectionId: string, remotePath: string, localPath: string): Promise<void> {
    const sftp = this.sftpConnections.get(connectionId);
    if (!sftp) throw new Error('SFTP connection not found');

    // Count files first
    console.log('[SFTPManager] Counting remote files...');
    const { count, totalBytes } = await this.countRemoteFiles(connectionId, remotePath);
    
    this.transferProgress = {
      totalFiles: count,
      completedFiles: 0,
      currentFile: remotePath,
      totalBytes,
      transferredBytes: 0,
    };
    this.emitTransferProgress(connectionId, 'download');

    // Create local directory
    if (!fs.existsSync(localPath)) {
      fs.mkdirSync(localPath, { recursive: true });
    }

    // Download recursively
    await this.downloadFolderRecursive(connectionId, remotePath, localPath);
  }

  private async downloadFolderRecursive(connectionId: string, remotePath: string, localPath: string): Promise<void> {
    const sftp = this.sftpConnections.get(connectionId);
    if (!sftp) throw new Error('SFTP connection not found');

    const items = await this.listFiles(connectionId, remotePath);
    
    for (const item of items) {
      const remoteItemPath = remotePath.endsWith('/') ? `${remotePath}${item.name}` : `${remotePath}/${item.name}`;
      const localItemPath = path.join(localPath, item.name);

      if (item.type === 'directory') {
        // Create local directory and recurse
        if (!fs.existsSync(localItemPath)) {
          fs.mkdirSync(localItemPath, { recursive: true });
        }
        await this.downloadFolderRecursive(connectionId, remoteItemPath, localItemPath);
      } else {
        // Update progress
        this.transferProgress.currentFile = item.name;
        this.emitTransferProgress(connectionId, 'download');

        // Download file
        await new Promise<void>((resolve, reject) => {
          sftp.fastGet(remoteItemPath, localItemPath, (err) => {
            if (err) {
              console.error('[SFTPManager] Download failed:', remoteItemPath, err.message);
              reject(err);
              return;
            }
            this.transferProgress.completedFiles++;
            this.transferProgress.transferredBytes += item.size;
            this.emitTransferProgress(connectionId, 'download');
            console.log('[SFTPManager] Downloaded:', remoteItemPath);
            resolve();
          });
        });
      }
    }
  }

  // Upload folder recursively with progress
  async uploadFolder(connectionId: string, localPath: string, remotePath: string): Promise<void> {
    const sftp = this.sftpConnections.get(connectionId);
    if (!sftp) throw new Error('SFTP connection not found');

    // Count files first
    console.log('[SFTPManager] Counting local files...');
    const { count, totalBytes } = this.countLocalFiles(localPath);
    
    this.transferProgress = {
      totalFiles: count,
      completedFiles: 0,
      currentFile: localPath,
      totalBytes,
      transferredBytes: 0,
    };
    this.emitTransferProgress(connectionId, 'upload');

    // Create remote directory
    try {
      await this.createDirectory(connectionId, remotePath);
    } catch (err: any) {
      // Directory might already exist
      if (!err.message?.includes('already exists')) {
        console.log('[SFTPManager] Directory may exist:', remotePath);
      }
    }

    // Upload recursively
    await this.uploadFolderRecursive(connectionId, localPath, remotePath);
  }

  private async uploadFolderRecursive(connectionId: string, localPath: string, remotePath: string): Promise<void> {
    const sftp = this.sftpConnections.get(connectionId);
    if (!sftp) throw new Error('SFTP connection not found');

    const items = fs.readdirSync(localPath, { withFileTypes: true });
    
    for (const item of items) {
      const localItemPath = path.join(localPath, item.name);
      const remoteItemPath = remotePath.endsWith('/') ? `${remotePath}${item.name}` : `${remotePath}/${item.name}`;

      if (item.isDirectory()) {
        // Create remote directory and recurse
        try {
          await this.createDirectory(connectionId, remoteItemPath);
        } catch (err: any) {
          // Directory might already exist
          console.log('[SFTPManager] Directory may exist:', remoteItemPath);
        }
        await this.uploadFolderRecursive(connectionId, localItemPath, remoteItemPath);
      } else {
        // Update progress
        this.transferProgress.currentFile = item.name;
        this.emitTransferProgress(connectionId, 'upload');

        const stat = fs.statSync(localItemPath);

        // Upload file
        await new Promise<void>((resolve, reject) => {
          sftp.fastPut(localItemPath, remoteItemPath, (err) => {
            if (err) {
              console.error('[SFTPManager] Upload failed:', localItemPath, err.message);
              reject(err);
              return;
            }
            this.transferProgress.completedFiles++;
            this.transferProgress.transferredBytes += stat.size;
            this.emitTransferProgress(connectionId, 'upload');
            console.log('[SFTPManager] Uploaded:', localItemPath);
            resolve();
          });
        });
      }
    }
  }

  private getFileType(mode: number): 'file' | 'directory' | 'symlink' {
    const S_IFMT = 0o170000;
    const S_IFREG = 0o100000;
    const S_IFDIR = 0o040000;
    const S_IFLNK = 0o120000;

    const fileType = mode & S_IFMT;
    
    if (fileType === S_IFDIR) return 'directory';
    if (fileType === S_IFLNK) return 'symlink';
    return 'file';
  }
}
