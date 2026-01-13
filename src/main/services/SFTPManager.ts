import { Client } from 'ssh2';
import { SFTPWrapper, FileEntry } from 'ssh2';

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

    return new Promise((resolve, reject) => {
      sftp.unlink(remotePath, (err) => {
        if (err) {
          reject(err);
          return;
        }
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
