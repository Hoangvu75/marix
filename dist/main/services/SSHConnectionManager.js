"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SSHConnectionManager = void 0;
const ssh2_1 = require("ssh2");
const events_1 = require("events");
// Legacy algorithms for old servers (CentOS 6, RHEL 6, etc.)
// OpenSSH 5.3 on CentOS 6 only supports these older algorithms
const LEGACY_ALGORITHMS = {
    kex: [
        // Modern (try first)
        'curve25519-sha256',
        'curve25519-sha256@libssh.org',
        'ecdh-sha2-nistp256',
        'ecdh-sha2-nistp384',
        'ecdh-sha2-nistp521',
        // Legacy (for old servers)
        'diffie-hellman-group-exchange-sha256',
        'diffie-hellman-group-exchange-sha1',
        'diffie-hellman-group14-sha1',
        'diffie-hellman-group1-sha1', // CentOS 6
    ],
    cipher: [
        // Modern
        'aes128-gcm@openssh.com',
        'aes256-gcm@openssh.com',
        'aes128-ctr',
        'aes192-ctr',
        'aes256-ctr',
        // Legacy
        'aes128-cbc',
        'aes192-cbc',
        'aes256-cbc',
        '3des-cbc', // CentOS 6
    ],
    serverHostKey: [
        // Modern
        'ssh-ed25519',
        'ecdsa-sha2-nistp256',
        'ecdsa-sha2-nistp384',
        'ecdsa-sha2-nistp521',
        'rsa-sha2-512',
        'rsa-sha2-256',
        // Legacy
        'ssh-rsa', // CentOS 6
        'ssh-dss', // Very old servers
    ],
    hmac: [
        // Modern
        'hmac-sha2-256-etm@openssh.com',
        'hmac-sha2-512-etm@openssh.com',
        'hmac-sha2-256',
        'hmac-sha2-512',
        // Legacy
        'hmac-sha1', // CentOS 6
        'hmac-md5', // Very old servers
    ],
};
class SSHConnectionManager {
    constructor() {
        this.connections = new Map();
        this.connectionConfigs = new Map();
        this.shells = new Map();
        this.shellEmitters = new Map();
    }
    async connect(config) {
        const connectionId = `${config.username}@${config.host}:${config.port}`;
        console.log('[SSHConnectionManager] Connecting:', connectionId);
        return new Promise((resolve, reject) => {
            const client = new ssh2_1.Client();
            // Store greeting and banner from client events
            let greeting = '';
            let banner = '';
            const connectConfig = {
                host: config.host,
                port: config.port,
                username: config.username,
                password: config.password,
                // Normalize private key: ensure LF line endings and trailing newline
                privateKey: config.privateKey
                    ? (typeof config.privateKey === 'string'
                        ? config.privateKey.replace(/\r\n/g, '\n').replace(/\r/g, '\n') + (config.privateKey.endsWith('\n') ? '' : '\n')
                        : config.privateKey)
                    : undefined,
                passphrase: config.passphrase,
                readyTimeout: 30000,
                keepaliveInterval: 10000,
                keepaliveCountMax: 3,
                // Enable legacy algorithms for old servers (CentOS 6, RHEL 6, etc.)
                algorithms: LEGACY_ALGORITHMS,
            };
            // Capture greeting (server identification)
            client.on('greeting', (message) => {
                console.log('[SSH] Greeting received:', message.substring(0, 100));
                greeting = message;
            });
            // Capture banner (pre-auth message)
            client.on('banner', (message) => {
                console.log('[SSH] Banner received:', message.substring(0, 100));
                banner = message;
            });
            client.on('ready', () => {
                console.log('[SSHConnectionManager] Connected successfully:', connectionId);
                this.connections.set(connectionId, { client, greeting, banner });
                this.connectionConfigs.set(connectionId, config);
                resolve(connectionId);
            });
            client.on('error', (err) => {
                console.error('[SSHConnectionManager] Connection error:', err.message);
                reject(new Error(err.message || 'SSH connection failed'));
            });
            client.on('close', () => {
                console.log('[SSHConnectionManager] Connection closed:', connectionId);
            });
            try {
                client.connect(connectConfig);
            }
            catch (err) {
                console.error('[SSHConnectionManager] Connect exception:', err.message);
                reject(err);
            }
        });
    }
    async disconnect(connectionId) {
        const shell = this.shells.get(connectionId);
        if (shell) {
            try {
                shell.end();
            }
            catch {
                // Ignore errors during close
            }
            this.shells.delete(connectionId);
        }
        const emitter = this.shellEmitters.get(connectionId);
        if (emitter) {
            emitter.removeAllListeners();
            this.shellEmitters.delete(connectionId);
        }
        const connData = this.connections.get(connectionId);
        if (connData) {
            try {
                // Use destroy() for faster close, end() waits for graceful shutdown
                connData.client.destroy();
            }
            catch {
                // Ignore errors during close
            }
            this.connections.delete(connectionId);
            this.connectionConfigs.delete(connectionId);
        }
    }
    async createShell(connectionId, cols = 80, rows = 24) {
        const connData = this.connections.get(connectionId);
        if (!connData) {
            throw new Error('Connection not found');
        }
        // Return existing shell if already created
        const existingEmitter = this.shellEmitters.get(connectionId);
        if (existingEmitter) {
            return existingEmitter;
        }
        const { client, greeting, banner } = connData;
        return new Promise((resolve, reject) => {
            // MUST use shell() with PTY - NOT exec()
            console.log('[SSH] Requesting shell with PTY...');
            client.shell({
                term: 'xterm-256color',
                cols,
                rows,
                width: cols * 9,
                height: rows * 17
            }, (err, stream) => {
                if (err) {
                    console.log('[SSH] Shell error:', err.message);
                    reject(err);
                    return;
                }
                console.log('[SSH] Shell stream created');
                const emitter = new events_1.EventEmitter();
                this.shells.set(connectionId, stream);
                this.shellEmitters.set(connectionId, emitter);
                // Buffer ALL data until renderer listener is ready
                let dataBuffer = [];
                let hasListener = false;
                // Pre-fill buffer with greeting and banner if available
                if (greeting) {
                    console.log('[SSH] Adding greeting to buffer:', greeting.length, 'bytes');
                    dataBuffer.push(greeting);
                }
                if (banner) {
                    console.log('[SSH] Adding banner to buffer:', banner.length, 'bytes');
                    dataBuffer.push(banner);
                }
                const flushBuffer = () => {
                    if (dataBuffer.length === 0) {
                        console.log('[SSH] Flush: buffer empty');
                        return;
                    }
                    const combined = dataBuffer.join('');
                    console.log('[SSH] Flushing:', combined.length, 'bytes');
                    dataBuffer = [];
                    emitter.emit('data', combined);
                };
                // Setup stream listener IMMEDIATELY
                stream.on('data', (data) => {
                    const str = data.toString('utf-8');
                    console.log('[SSH] Stream data:', data.length, 'bytes, hasListener:', hasListener);
                    if (hasListener) {
                        emitter.emit('data', str);
                    }
                    else {
                        dataBuffer.push(str);
                    }
                });
                stream.stderr.on('data', (data) => {
                    console.log('[SSH] Stderr:', data.length, 'bytes');
                    if (hasListener) {
                        emitter.emit('data', data.toString('utf-8'));
                    }
                    else {
                        dataBuffer.push(data.toString('utf-8'));
                    }
                });
                stream.on('close', () => {
                    console.log('[SSH] Stream closed');
                    emitter.emit('close');
                    this.shells.delete(connectionId);
                    this.shellEmitters.delete(connectionId);
                });
                // Override 'on' to detect when renderer attaches listener
                const originalOn = emitter.on.bind(emitter);
                emitter.on = function (event, listener) {
                    const result = originalOn(event, listener);
                    if (event === 'data' && !hasListener) {
                        hasListener = true;
                        console.log('[SSH] Listener attached! Buffered chunks:', dataBuffer.length);
                        // Fetch MOTD first, then flush everything in correct order
                        client.exec('cat /run/motd.dynamic 2>/dev/null || cat /etc/motd 2>/dev/null', (err, motdStream) => {
                            if (err) {
                                flushBuffer();
                                return;
                            }
                            let motd = '';
                            motdStream.on('data', (data) => {
                                motd += data.toString('utf-8');
                            });
                            motdStream.on('close', () => {
                                if (motd.trim()) {
                                    console.log('[SSH] MOTD fetched:', motd.length, 'bytes');
                                    // Emit MOTD first (with newline)
                                    emitter.emit('data', '\r\n' + motd + '\r\n');
                                }
                                // Then flush buffered shell data (prompt)
                                flushBuffer();
                            });
                        });
                    }
                    return result;
                };
                // Resolve immediately
                console.log('[SSH] Shell ready, resolving...');
                resolve(emitter);
            });
        });
    }
    writeToShell(connectionId, data) {
        const shell = this.shells.get(connectionId);
        if (!shell) {
            throw new Error('Shell not found');
        }
        shell.write(data);
    }
    resizeShell(connectionId, cols, rows) {
        const shell = this.shells.get(connectionId);
        if (shell) {
            shell.setWindow(rows, cols, 0, 0);
        }
    }
    getConnection(connectionId) {
        return this.connections.get(connectionId)?.client;
    }
    async executeCommand(connectionId, command) {
        const connData = this.connections.get(connectionId);
        if (!connData) {
            throw new Error('Connection not found');
        }
        return new Promise((resolve, reject) => {
            connData.client.exec(command, (err, stream) => {
                if (err) {
                    reject(err);
                    return;
                }
                let output = '';
                let errorOutput = '';
                stream.on('close', (code, signal) => {
                    if (code !== 0) {
                        reject(new Error(errorOutput || `Command failed with code ${code}`));
                    }
                    else {
                        resolve(output);
                    }
                });
                stream.on('data', (data) => {
                    output += data.toString();
                });
                stream.stderr.on('data', (data) => {
                    errorOutput += data.toString();
                });
            });
        });
    }
    /**
     * Execute command with streaming output via callback
     */
    async executeCommandStream(connectionId, command, onData) {
        const connData = this.connections.get(connectionId);
        if (!connData) {
            throw new Error('Connection not found');
        }
        return new Promise((resolve, reject) => {
            connData.client.exec(command, { pty: true }, (err, stream) => {
                if (err) {
                    reject(err);
                    return;
                }
                stream.on('close', (code) => {
                    resolve({ success: code === 0, exitCode: code });
                });
                stream.on('data', (data) => {
                    onData(data.toString(), false);
                });
                stream.stderr.on('data', (data) => {
                    onData(data.toString(), true);
                });
            });
        });
    }
    getAllConnections() {
        return Array.from(this.connections.keys());
    }
    isConnected(connectionId) {
        return this.connections.has(connectionId);
    }
    /**
     * Get the number of active connections
     */
    getActiveCount() {
        return this.connections.size;
    }
    /**
     * Close all connections - called when app is closing
     */
    closeAll() {
        console.log(`[SSHConnectionManager] Closing all ${this.connections.size} connections...`);
        for (const [id] of this.connections) {
            this.disconnect(id);
        }
        console.log('[SSHConnectionManager] All connections closed');
    }
}
exports.SSHConnectionManager = SSHConnectionManager;
//# sourceMappingURL=SSHConnectionManager.js.map