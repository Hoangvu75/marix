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
exports.NativeSSHManager = void 0;
const pty = __importStar(require("node-pty"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const events_1 = require("events");
class NativeSSHManager {
    constructor() {
        this.sessions = new Map();
    }
    /**
     * Connect and create shell using native SSH command
     * This triggers PAM properly so MOTD displays automatically
     */
    async connectAndCreateShell(config, cols = 80, rows = 24) {
        const connectionId = `${config.username}@${config.host}:${config.port}`;
        console.log('[NativeSSH] Connecting:', connectionId);
        // Check if already connected
        if (this.sessions.has(connectionId)) {
            const session = this.sessions.get(connectionId);
            return { connectionId, emitter: session.emitter };
        }
        const emitter = new events_1.EventEmitter();
        let keyFilePath;
        // Build SSH command
        const sshArgs = [
            '-o', 'StrictHostKeyChecking=no',
            '-o', 'UserKnownHostsFile=/dev/null',
            '-o', 'LogLevel=ERROR',
            '-p', config.port.toString(),
            `${config.username}@${config.host}`
        ];
        // If using private key
        if (config.authType === 'key' && config.privateKey) {
            // Write key to temp file (SSH requires file path)
            const tempDir = os.tmpdir();
            keyFilePath = path.join(tempDir, `ssh_key_${Date.now()}`);
            fs.writeFileSync(keyFilePath, config.privateKey, { mode: 0o600 });
            sshArgs.unshift('-i', keyFilePath);
            console.log('[NativeSSH] Using private key');
        }
        console.log('[NativeSSH] Spawning:', 'ssh', sshArgs.join(' '));
        // Spawn SSH process with PTY
        const ptyProcess = pty.spawn('ssh', sshArgs, {
            name: 'xterm-256color',
            cols,
            rows,
            cwd: process.env.HOME,
            env: process.env
        });
        // Track password/passphrase state
        let passwordSent = false;
        let passphraseSent = false;
        let dataBuffer = '';
        // Forward data from PTY to emitter
        ptyProcess.onData((data) => {
            dataBuffer += data;
            // Handle passphrase for encrypted key
            if (config.authType === 'key' && config.passphrase && !passphraseSent) {
                if (dataBuffer.toLowerCase().includes('passphrase') ||
                    dataBuffer.toLowerCase().includes('enter passphrase')) {
                    console.log('[NativeSSH] Passphrase prompt detected');
                    passphraseSent = true;
                    setTimeout(() => {
                        ptyProcess.write(config.passphrase + '\r');
                    }, 50);
                    return;
                }
            }
            // Handle password authentication
            if (config.password && !passwordSent && config.authType !== 'key') {
                // Check for password prompt
                if (dataBuffer.toLowerCase().includes('password:')) {
                    console.log('[NativeSSH] Password prompt detected, sending password');
                    passwordSent = true;
                    // Send password after small delay
                    setTimeout(() => {
                        ptyProcess.write(config.password + '\r');
                    }, 50);
                    // Don't emit password prompt
                    return;
                }
            }
            // Emit data to terminal
            emitter.emit('data', data);
        });
        ptyProcess.onExit(({ exitCode, signal }) => {
            console.log('[NativeSSH] Process exited:', exitCode, signal);
            emitter.emit('close');
            // Cleanup temp key file
            if (keyFilePath && fs.existsSync(keyFilePath)) {
                fs.unlinkSync(keyFilePath);
                console.log('[NativeSSH] Cleaned up temp key file');
            }
            this.sessions.delete(connectionId);
        });
        // Store session
        this.sessions.set(connectionId, {
            pty: ptyProcess,
            emitter,
            config,
            keyFile: keyFilePath
        });
        return { connectionId, emitter };
    }
    /**
     * Write data to shell
     */
    writeToShell(connectionId, data) {
        const session = this.sessions.get(connectionId);
        if (session) {
            session.pty.write(data);
        }
    }
    /**
     * Resize shell
     */
    resizeShell(connectionId, cols, rows) {
        const session = this.sessions.get(connectionId);
        if (session) {
            session.pty.resize(cols, rows);
        }
    }
    /**
     * Disconnect and close shell
     */
    disconnect(connectionId) {
        const session = this.sessions.get(connectionId);
        if (session) {
            console.log('[NativeSSH] Disconnecting:', connectionId);
            session.pty.kill();
            session.emitter.removeAllListeners();
            // Cleanup temp key file
            if (session.keyFile && fs.existsSync(session.keyFile)) {
                fs.unlinkSync(session.keyFile);
                console.log('[NativeSSH] Cleaned up temp key file');
            }
            this.sessions.delete(connectionId);
        }
    }
    /**
     * Check if connected
     */
    isConnected(connectionId) {
        return this.sessions.has(connectionId);
    }
    /**
     * Get config for SFTP (reuse credentials)
     */
    getConfig(connectionId) {
        return this.sessions.get(connectionId)?.config;
    }
    /**
     * Create a local terminal shell (no SSH)
     */
    createLocalShell(cols = 80, rows = 24) {
        const connectionId = `local-${Date.now()}`;
        console.log('[NativeSSH] Creating local shell:', connectionId);
        const emitter = new events_1.EventEmitter();
        // Determine shell based on OS
        const isWindows = process.platform === 'win32';
        const shell = isWindows
            ? process.env.COMSPEC || 'cmd.exe'
            : process.env.SHELL || '/bin/bash';
        // Spawn local shell process with PTY
        const ptyProcess = pty.spawn(shell, [], {
            name: 'xterm-256color',
            cols,
            rows,
            cwd: process.env.HOME || process.cwd(),
            env: process.env
        });
        // Forward data from PTY to emitter
        ptyProcess.onData((data) => {
            emitter.emit('data', data);
        });
        // Handle exit
        ptyProcess.onExit(({ exitCode, signal }) => {
            console.log('[NativeSSH] Local shell exited:', connectionId, 'code:', exitCode);
            emitter.emit('close', { exitCode, signal });
            this.sessions.delete(connectionId);
        });
        // Store session (reuse session structure with dummy config)
        this.sessions.set(connectionId, {
            pty: ptyProcess,
            emitter,
            config: { host: 'localhost', port: 0, username: os.userInfo().username }
        });
        return { connectionId, emitter };
    }
    /**
     * Close all connections - called when app is closing
     */
    closeAll() {
        console.log(`[NativeSSH] Closing all ${this.sessions.size} sessions...`);
        for (const [id] of this.sessions) {
            this.disconnect(id);
        }
        console.log('[NativeSSH] All sessions closed');
    }
}
exports.NativeSSHManager = NativeSSHManager;
//# sourceMappingURL=NativeSSHManager.js.map