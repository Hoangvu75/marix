import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { spawn } from 'child_process';

export interface KnownHost {
  host: string;
  port: number;
  keyType: string;
  fingerprint: string;
  fullKey: string;
  addedAt: string;
}

export interface FingerprintResult {
  status: 'new' | 'match' | 'changed' | 'error';
  keyType?: string;
  fingerprint?: string;
  fullKey?: string;
  previousFingerprint?: string;
  error?: string;
}

export class KnownHostsService {
  private knownHostsFile: string;
  private knownHosts: Map<string, KnownHost> = new Map();

  constructor() {
    // Store in app data directory
    const appDataDir = path.join(os.homedir(), '.marix');
    if (!fs.existsSync(appDataDir)) {
      fs.mkdirSync(appDataDir, { recursive: true });
    }
    this.knownHostsFile = path.join(appDataDir, 'known_hosts.json');
    this.loadKnownHosts();
  }

  private loadKnownHosts(): void {
    try {
      if (fs.existsSync(this.knownHostsFile)) {
        const data = JSON.parse(fs.readFileSync(this.knownHostsFile, 'utf-8'));
        this.knownHosts = new Map(Object.entries(data));
      }
    } catch (err) {
      console.error('[KnownHostsService] Failed to load known hosts:', err);
      this.knownHosts = new Map();
    }
  }

  private saveKnownHosts(): void {
    try {
      const data = Object.fromEntries(this.knownHosts);
      fs.writeFileSync(this.knownHostsFile, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error('[KnownHostsService] Failed to save known hosts:', err);
    }
  }

  private getHostKey(host: string, port: number): string {
    return port === 22 ? host : `[${host}]:${port}`;
  }

  /**
   * Fetch SSH host fingerprint using ssh-keyscan
   */
  async getHostFingerprint(host: string, port: number): Promise<FingerprintResult> {
    return new Promise((resolve) => {
      const hostKey = this.getHostKey(host, port);
      
      // Use ssh-keyscan to get host key
      const args = ['-p', port.toString(), '-T', '5', host];
      const keyscan = spawn('ssh-keyscan', args);
      
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
          if (line.startsWith('#')) continue;
          const parts = line.split(' ');
          if (parts.length >= 3) {
            const type = parts[1];
            if (type === 'ssh-ed25519' || (!keyType || keyType === 'ssh-rsa')) {
              keyType = type;
              bestKey = parts.slice(1).join(' ');
            } else if (type.startsWith('ecdsa') && keyType !== 'ssh-ed25519') {
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
        } else if (existingHost.fingerprint === fingerprint) {
          resolve({
            status: 'match',
            keyType,
            fingerprint,
            fullKey: bestKey
          });
        } else {
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

      // Timeout after 10 seconds
      setTimeout(() => {
        keyscan.kill();
        resolve({
          status: 'error',
          error: 'Timeout fetching host key'
        });
      }, 10000);
    });
  }

  /**
   * Add or update a known host
   */
  addKnownHost(host: string, port: number, keyType: string, fingerprint: string, fullKey: string): void {
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
  removeKnownHost(host: string, port: number): void {
    const hostKey = this.getHostKey(host, port);
    this.knownHosts.delete(hostKey);
    this.saveKnownHosts();
    console.log('[KnownHostsService] Removed known host:', hostKey);
  }

  /**
   * Get a known host entry
   */
  getKnownHost(host: string, port: number): KnownHost | undefined {
    const hostKey = this.getHostKey(host, port);
    return this.knownHosts.get(hostKey);
  }

  /**
   * Get all known hosts
   */
  getAllKnownHosts(): KnownHost[] {
    return Array.from(this.knownHosts.values());
  }

  /**
   * Check if host is known
   */
  isHostKnown(host: string, port: number): boolean {
    const hostKey = this.getHostKey(host, port);
    return this.knownHosts.has(hostKey);
  }

  /**
   * Clear all known hosts
   */
  clearAllKnownHosts(): void {
    this.knownHosts.clear();
    this.saveKnownHosts();
    console.log('[KnownHostsService] Cleared all known hosts');
  }
}

export const knownHostsService = new KnownHostsService();
