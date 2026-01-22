"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.FTPManager = void 0;
const ftp = __importStar(require("basic-ftp"));
const stream_1 = require("stream");
class FTPManager {
    constructor() {
        this.connections = new Map();
    }
    // Queue wrapper to serialize FTP operations
    async enqueue(connectionId, operation) {
        const conn = this.connections.get(connectionId);
        if (!conn) {
            throw new Error('FTP not connected');
        }
        // Chain operation to the queue
        const result = conn.queue.then(operation, operation);
        conn.queue = result.catch(() => { }); // Prevent unhandled rejection
        return result;
    }
    async connect(connectionId, config) {
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
        }
        catch (err) {
            console.error('[FTPManager] Connection failed:', err.message);
            throw err;
        }
    }
    async disconnect(connectionId) {
        const conn = this.connections.get(connectionId);
        if (conn) {
            conn.client.close();
            this.connections.delete(connectionId);
            console.log('[FTPManager] Disconnected:', connectionId);
        }
    }
    async listFiles(connectionId, remotePath) {
        return this.enqueue(connectionId, async () => {
            const conn = this.connections.get(connectionId);
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
    async downloadFile(connectionId, remotePath, localPath) {
        return this.enqueue(connectionId, async () => {
            const conn = this.connections.get(connectionId);
            await conn.client.downloadTo(localPath, remotePath);
            console.log('[FTPManager] Downloaded:', remotePath, '->', localPath);
        });
    }
    async uploadFile(connectionId, localPath, remotePath) {
        return this.enqueue(connectionId, async () => {
            const conn = this.connections.get(connectionId);
            await conn.client.uploadFrom(localPath, remotePath);
            console.log('[FTPManager] Uploaded:', localPath, '->', remotePath);
        });
    }
    async deleteFile(connectionId, remotePath) {
        return this.enqueue(connectionId, async () => {
            const conn = this.connections.get(connectionId);
            await conn.client.remove(remotePath);
            console.log('[FTPManager] Deleted file:', remotePath);
        });
    }
    async deleteDirectory(connectionId, remotePath) {
        return this.enqueue(connectionId, async () => {
            const conn = this.connections.get(connectionId);
            await conn.client.removeDir(remotePath);
            console.log('[FTPManager] Deleted directory:', remotePath);
        });
    }
    async createDirectory(connectionId, remotePath) {
        return this.enqueue(connectionId, async () => {
            const conn = this.connections.get(connectionId);
            await conn.client.ensureDir(remotePath);
            console.log('[FTPManager] Created directory:', remotePath);
        });
    }
    async rename(connectionId, oldPath, newPath) {
        return this.enqueue(connectionId, async () => {
            const conn = this.connections.get(connectionId);
            await conn.client.rename(oldPath, newPath);
            console.log('[FTPManager] Renamed:', oldPath, '->', newPath);
        });
    }
    async readFile(connectionId, remotePath) {
        return this.enqueue(connectionId, async () => {
            const conn = this.connections.get(connectionId);
            const chunks = [];
            const writable = new stream_1.Writable({
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
    async writeFile(connectionId, remotePath, content) {
        return this.enqueue(connectionId, async () => {
            const conn = this.connections.get(connectionId);
            const readable = stream_1.Readable.from([content]);
            await conn.client.uploadFrom(readable, remotePath);
            console.log('[FTPManager] Wrote file:', remotePath, 'size:', content.length);
        });
    }
    isConnected(connectionId) {
        const conn = this.connections.get(connectionId);
        return conn !== undefined && !conn.client.closed;
    }
    parsePermissions(perms) {
        let mode = 0;
        if (perms.user) {
            if (perms.user & 4)
                mode |= 0o400;
            if (perms.user & 2)
                mode |= 0o200;
            if (perms.user & 1)
                mode |= 0o100;
        }
        if (perms.group) {
            if (perms.group & 4)
                mode |= 0o040;
            if (perms.group & 2)
                mode |= 0o020;
            if (perms.group & 1)
                mode |= 0o010;
        }
        if (perms.world) {
            if (perms.world & 4)
                mode |= 0o004;
            if (perms.world & 2)
                mode |= 0o002;
            if (perms.world & 1)
                mode |= 0o001;
        }
        return mode;
    }
    getActiveCount() {
        return this.connections.size;
    }
    closeAll() {
        console.log(`[FTPManager] Closing all ${this.connections.size} connections...`);
        for (const [id, conn] of this.connections) {
            try {
                conn.client.close();
            }
            catch (e) {
                console.log(`[FTPManager] Error closing ${id}:`, e);
            }
        }
        this.connections.clear();
        console.log('[FTPManager] All connections closed');
    }
}
exports.FTPManager = FTPManager;
//# sourceMappingURL=FTPManager.js.map