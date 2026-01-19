"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SFTPManager = void 0;
const electron_1 = require("electron");
class SFTPManager {
    constructor() {
        this.sftpConnections = new Map();
        // Track delete count for progress reporting
        this.deleteCount = 0;
    }
    async connect(connectionId, sshClient) {
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
    async listFiles(connectionId, remotePath) {
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
                const files = list.map((item) => ({
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
    async downloadFile(connectionId, remotePath, localPath) {
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
    async uploadFile(connectionId, localPath, remotePath) {
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
    async deleteFile(connectionId, remotePath) {
        const sftp = this.sftpConnections.get(connectionId);
        if (!sftp) {
            throw new Error('SFTP connection not found');
        }
        // First check if it's a file or directory
        const stats = await new Promise((resolve, reject) => {
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
    async createDirectory(connectionId, remotePath) {
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
    async readFile(connectionId, remotePath) {
        const sftp = this.sftpConnections.get(connectionId);
        if (!sftp) {
            throw new Error('SFTP connection not found');
        }
        return new Promise((resolve, reject) => {
            const chunks = [];
            const readStream = sftp.createReadStream(remotePath);
            readStream.on('data', (chunk) => {
                chunks.push(chunk);
            });
            readStream.on('error', (err) => reject(err));
            readStream.on('end', () => {
                const content = Buffer.concat(chunks).toString('utf8');
                resolve(content);
            });
        });
    }
    async writeFile(connectionId, remotePath, content) {
        const sftp = this.sftpConnections.get(connectionId);
        if (!sftp) {
            throw new Error('SFTP connection not found');
        }
        return new Promise((resolve, reject) => {
            const writeStream = sftp.createWriteStream(remotePath);
            writeStream.on('error', (err) => reject(err));
            writeStream.on('close', () => resolve());
            writeStream.write(content);
            writeStream.end();
        });
    }
    async chmod(connectionId, remotePath, mode) {
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
    async rename(connectionId, oldPath, newPath) {
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
    async deleteDirectory(connectionId, remotePath) {
        const sftp = this.sftpConnections.get(connectionId);
        if (!sftp) {
            throw new Error('SFTP connection not found');
        }
        // First, try to delete directly (works for empty directories)
        try {
            await new Promise((resolve, reject) => {
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
        }
        catch (err) {
            // If directory not empty, we need to delete recursively
            if (err.message?.includes('Failure') || err.code === 4) {
                console.log('[SFTPManager] Directory not empty, deleting recursively:', remotePath);
                await this.deleteDirectoryRecursive(connectionId, remotePath);
                return;
            }
            throw err;
        }
    }
    // Emit delete progress to renderer
    emitDeleteProgress(connectionId, path, type, count) {
        const windows = electron_1.BrowserWindow.getAllWindows();
        for (const win of windows) {
            win.webContents.send('sftp:delete-progress', { connectionId, path, type, count });
        }
    }
    // Recursive delete for non-empty directories
    async deleteDirectoryRecursive(connectionId, remotePath, isRoot = true) {
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
            }
            else {
                // Send progress event
                this.deleteCount++;
                this.emitDeleteProgress(connectionId, itemPath, 'file', this.deleteCount);
                // Delete file
                await new Promise((resolve, reject) => {
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
        await new Promise((resolve, reject) => {
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
    disconnect(connectionId) {
        const sftp = this.sftpConnections.get(connectionId);
        if (sftp) {
            sftp.end();
            this.sftpConnections.delete(connectionId);
        }
    }
    getFileType(mode) {
        const S_IFMT = 0o170000;
        const S_IFREG = 0o100000;
        const S_IFDIR = 0o040000;
        const S_IFLNK = 0o120000;
        const fileType = mode & S_IFMT;
        if (fileType === S_IFDIR)
            return 'directory';
        if (fileType === S_IFLNK)
            return 'symlink';
        return 'file';
    }
}
exports.SFTPManager = SFTPManager;
//# sourceMappingURL=SFTPManager.js.map