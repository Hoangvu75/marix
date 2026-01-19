import { Client } from 'ssh2';
import { SFTPWrapper, FileEntry } from 'ssh2';
import { BrowserWindow } from 'electron';

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
