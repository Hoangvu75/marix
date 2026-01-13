"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SFTPManager = void 0;
class SFTPManager {
    constructor() {
        this.sftpConnections = new Map();
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