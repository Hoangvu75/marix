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
exports.knownHostsService = exports.KnownHostsService = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const crypto = __importStar(require("crypto"));
const child_process_1 = require("child_process");
class KnownHostsService {
    constructor() {
        this.knownHosts = new Map();
        // Store in app data directory
        const appDataDir = path.join(os.homedir(), '.marix');
        if (!fs.existsSync(appDataDir)) {
            fs.mkdirSync(appDataDir, { recursive: true });
        }
        this.knownHostsFile = path.join(appDataDir, 'known_hosts.json');
        this.loadKnownHosts();
    }
    loadKnownHosts() {
        try {
            if (fs.existsSync(this.knownHostsFile)) {
                const data = JSON.parse(fs.readFileSync(this.knownHostsFile, 'utf-8'));
                this.knownHosts = new Map(Object.entries(data));
            }
        }
        catch (err) {
            console.error('[KnownHostsService] Failed to load known hosts:', err);
            this.knownHosts = new Map();
        }
    }
    saveKnownHosts() {
        try {
            const data = Object.fromEntries(this.knownHosts);
            fs.writeFileSync(this.knownHostsFile, JSON.stringify(data, null, 2));
        }
        catch (err) {
            console.error('[KnownHostsService] Failed to save known hosts:', err);
        }
    }
    getHostKey(host, port) {
        return port === 22 ? host : `[${host}]:${port}`;
    }
    /**
     * Quick check if host is already known (no network call)
     * Returns 'known' if in known_hosts, 'unknown' if not
     */
    isHostKnown(host, port) {
        const hostKey = this.getHostKey(host, port);
        return this.knownHosts.has(hostKey);
    }
    /**
     * Get stored fingerprint for a known host (no network call)
     */
    getStoredFingerprint(host, port) {
        const hostKey = this.getHostKey(host, port);
        return this.knownHosts.get(hostKey) || null;
    }
    /**
     * Fetch SSH host fingerprint using ssh-keyscan
     */
    async getHostFingerprint(host, port) {
        return new Promise((resolve) => {
            const hostKey = this.getHostKey(host, port);
            // Use ssh-keyscan to get host key (2 second timeout for faster response)
            const args = ['-p', port.toString(), '-T', '2', host];
            const keyscan = (0, child_process_1.spawn)('ssh-keyscan', args);
            let stdout = '';
            let stderr = '';
            keyscan.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            keyscan.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            keyscan.on('close', (code) => {
                if (!stdout.trim()) {
                    resolve({
                        status: 'error',
                        error: 'Could not fetch host key. Host may be unreachable or SSH not running.'
                    });
                    return;
                }
                // Parse the key from output (format: host keytype key)
                const lines = stdout.trim().split('\n');
                let bestKey = '';
                let keyType = '';
                // Prefer ed25519 > ecdsa > rsa
                for (const line of lines) {
                    if (line.startsWith('#'))
                        continue;
                    const parts = line.split(' ');
                    if (parts.length >= 3) {
                        const type = parts[1];
                        if (type === 'ssh-ed25519' || (!keyType || keyType === 'ssh-rsa')) {
                            keyType = type;
                            bestKey = parts.slice(1).join(' ');
                        }
                        else if (type.startsWith('ecdsa') && keyType !== 'ssh-ed25519') {
                            keyType = type;
                            bestKey = parts.slice(1).join(' ');
                        }
                    }
                }
                if (!bestKey) {
                    resolve({
                        status: 'error',
                        error: 'Could not parse host key from ssh-keyscan output'
                    });
                    return;
                }
                // Generate fingerprint (SHA256)
                const keyData = bestKey.split(' ')[1]; // Get the base64 key part
                const keyBuffer = Buffer.from(keyData, 'base64');
                const hash = crypto.createHash('sha256').update(keyBuffer).digest('base64');
                const fingerprint = `SHA256:${hash.replace(/=+$/, '')}`;
                // Check against known hosts
                const existingHost = this.knownHosts.get(hostKey);
                if (!existingHost) {
                    resolve({
                        status: 'new',
                        keyType,
                        fingerprint,
                        fullKey: bestKey
                    });
                }
                else if (existingHost.fingerprint === fingerprint) {
                    resolve({
                        status: 'match',
                        keyType,
                        fingerprint,
                        fullKey: bestKey
                    });
                }
                else {
                    resolve({
                        status: 'changed',
                        keyType,
                        fingerprint,
                        fullKey: bestKey,
                        previousFingerprint: existingHost.fingerprint
                    });
                }
            });
            keyscan.on('error', (err) => {
                resolve({
                    status: 'error',
                    error: `ssh-keyscan error: ${err.message}`
                });
            });
            // Timeout after 3 seconds (faster than before)
            setTimeout(() => {
                keyscan.kill();
                resolve({
                    status: 'error',
                    error: 'Timeout fetching host key'
                });
            }, 3000);
        });
    }
    /**
     * Add or update a known host
     */
    addKnownHost(host, port, keyType, fingerprint, fullKey) {
        const hostKey = this.getHostKey(host, port);
        this.knownHosts.set(hostKey, {
            host,
            port,
            keyType,
            fingerprint,
            fullKey,
            addedAt: new Date().toISOString()
        });
        this.saveKnownHosts();
        console.log('[KnownHostsService] Added known host:', hostKey);
    }
    /**
     * Remove a known host
     */
    removeKnownHost(host, port) {
        const hostKey = this.getHostKey(host, port);
        this.knownHosts.delete(hostKey);
        this.saveKnownHosts();
        console.log('[KnownHostsService] Removed known host:', hostKey);
    }
    /**
     * Get a known host entry
     */
    getKnownHost(host, port) {
        const hostKey = this.getHostKey(host, port);
        return this.knownHosts.get(hostKey);
    }
    /**
     * Get all known hosts
     */
    getAllKnownHosts() {
        return Array.from(this.knownHosts.values());
    }
    /**
     * Clear all known hosts
     */
    clearAllKnownHosts() {
        this.knownHosts.clear();
        this.saveKnownHosts();
        console.log('[KnownHostsService] Cleared all known hosts');
    }
}
exports.KnownHostsService = KnownHostsService;
exports.knownHostsService = new KnownHostsService();
//# sourceMappingURL=KnownHostsService.js.map