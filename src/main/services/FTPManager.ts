import * as ftp from 'basic-ftp';
import { Readable, Writable } from 'stream';

interface FTPConnection {
  client: ftp.Client;
  config: {
    host: string;
    port: number;
    username: string;
    password?: string;
    secure: boolean | 'implicit';
  };
  queue: Promise<any>; // Queue for serializing operations
}

export class FTPManager {
  private connections: Map<string, FTPConnection> = new Map();

  // Queue wrapper to serialize FTP operations
  private async enqueue<T>(connectionId: string, operation: () => Promise<T>): Promise<T> {
    const conn = this.connections.get(connectionId);
    if (!conn) {
      throw new Error('FTP not connected');
    }
    
    // Chain operation to the queue
    const result = conn.queue.then(operation, operation);
    conn.queue = result.catch(() => {}); // Prevent unhandled rejection
    return result;
  }

  async connect(connectionId: string, config: {
    host: string;
    port: number;
    username: string;
    password?: string;
    protocol: 'ftp' | 'ftps';
  }): Promise<void> {
    // Close existing connection if any
    await this.disconnect(connectionId);

    const client = new ftp.Client();
    client.ftp.verbose = true; // Enable verbose logging for debugging
    
    // Set timeout (30 seconds)
    client.ftp.socket.setTimeout(30000);

    try {
      const secure = config.protocol === 'ftps' ? 'implicit' : false;
      
      console.log('[FTPManager] Connecting to', config.host, ':', config.port, 'secure:', secure);
      
      await client.access({
        host: config.host,
        port: config.port,
        user: config.username,
        password: config.password || '',
        secure: secure,
        secureOptions: secure ? { rejectUnauthorized: false } : undefined,
      });

      this.connections.set(connectionId, {
        client,
        config: {
          host: config.host,
          port: config.port,
          username: config.username,
          password: config.password,
          secure,
        },
        queue: Promise.resolve(), // Initialize empty queue
      });

      console.log('[FTPManager] Connected:', connectionId);
    } catch (err: any) {
      console.error('[FTPManager] Connection failed:', err.message);
      throw err;
    }
  }

  async disconnect(connectionId: string): Promise<void> {
    const conn = this.connections.get(connectionId);
    if (conn) {
      conn.client.close();
      this.connections.delete(connectionId);
      console.log('[FTPManager] Disconnected:', connectionId);
    }
  }

  async listFiles(connectionId: string, remotePath: string): Promise<any[]> {
    return this.enqueue(connectionId, async () => {
      const conn = this.connections.get(connectionId)!;
      const list = await conn.client.list(remotePath);
      return list.map(item => ({
        name: item.name,
        type: item.type === ftp.FileType.Directory ? 'directory' : 'file',
        size: item.size,
        modifyTime: item.modifiedAt ? item.modifiedAt.getTime() : Date.now(),
        permissions: item.permissions ? this.parsePermissions(item.permissions) : undefined,
      }));
    });
  }

  async downloadFile(connectionId: string, remotePath: string, localPath: string): Promise<void> {
    return this.enqueue(connectionId, async () => {
      const conn = this.connections.get(connectionId)!;
      await conn.client.downloadTo(localPath, remotePath);
      console.log('[FTPManager] Downloaded:', remotePath, '->', localPath);
    });
  }

  async uploadFile(connectionId: string, localPath: string, remotePath: string): Promise<void> {
    return this.enqueue(connectionId, async () => {
      const conn = this.connections.get(connectionId)!;
      await conn.client.uploadFrom(localPath, remotePath);
      console.log('[FTPManager] Uploaded:', localPath, '->', remotePath);
    });
  }

  async deleteFile(connectionId: string, remotePath: string): Promise<void> {
    return this.enqueue(connectionId, async () => {
      const conn = this.connections.get(connectionId)!;
      await conn.client.remove(remotePath);
      console.log('[FTPManager] Deleted file:', remotePath);
    });
  }

  async deleteDirectory(connectionId: string, remotePath: string): Promise<void> {
    return this.enqueue(connectionId, async () => {
      const conn = this.connections.get(connectionId)!;
      await conn.client.removeDir(remotePath);
      console.log('[FTPManager] Deleted directory:', remotePath);
    });
  }

  async createDirectory(connectionId: string, remotePath: string): Promise<void> {
    return this.enqueue(connectionId, async () => {
      const conn = this.connections.get(connectionId)!;
      await conn.client.ensureDir(remotePath);
      console.log('[FTPManager] Created directory:', remotePath);
    });
  }

  async rename(connectionId: string, oldPath: string, newPath: string): Promise<void> {
    return this.enqueue(connectionId, async () => {
      const conn = this.connections.get(connectionId)!;
      await conn.client.rename(oldPath, newPath);
      console.log('[FTPManager] Renamed:', oldPath, '->', newPath);
    });
  }

  async readFile(connectionId: string, remotePath: string): Promise<string> {
    return this.enqueue(connectionId, async () => {
      const conn = this.connections.get(connectionId)!;
      const chunks: Buffer[] = [];
      const writable = new Writable({
        write(chunk, encoding, callback) {
          chunks.push(Buffer.from(chunk));
          callback();
        },
      });
      await conn.client.downloadTo(writable, remotePath);
      const content = Buffer.concat(chunks).toString('utf-8');
      console.log('[FTPManager] Read file:', remotePath, 'size:', content.length);
      return content;
    });
  }

  async writeFile(connectionId: string, remotePath: string, content: string): Promise<void> {
    return this.enqueue(connectionId, async () => {
      const conn = this.connections.get(connectionId)!;
      const readable = Readable.from([content]);
      await conn.client.uploadFrom(readable, remotePath);
      console.log('[FTPManager] Wrote file:', remotePath, 'size:', content.length);
    });
  }

  isConnected(connectionId: string): boolean {
    const conn = this.connections.get(connectionId);
    return conn !== undefined && !conn.client.closed;
  }

  private parsePermissions(perms: ftp.UnixPermissions): number {
    let mode = 0;
    if (perms.user) {
      if (perms.user & 4) mode |= 0o400;
      if (perms.user & 2) mode |= 0o200;
      if (perms.user & 1) mode |= 0o100;
    }
    if (perms.group) {
      if (perms.group & 4) mode |= 0o040;
      if (perms.group & 2) mode |= 0o020;
      if (perms.group & 1) mode |= 0o010;
    }
    if (perms.world) {
      if (perms.world & 4) mode |= 0o004;
      if (perms.world & 2) mode |= 0o002;
      if (perms.world & 1) mode |= 0o001;
    }
    return mode;
  }

  getActiveCount(): number {
    return this.connections.size;
  }

  closeAll(): void {
    console.log(`[FTPManager] Closing all ${this.connections.size} connections...`);
    for (const [id, conn] of this.connections) {
      try {
        conn.client.close();
      } catch (e) {
        console.log(`[FTPManager] Error closing ${id}:`, e);
      }
    }
    this.connections.clear();
    console.log('[FTPManager] All connections closed');
  }
}
