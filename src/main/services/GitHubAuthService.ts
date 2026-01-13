import * as https from 'https';
import { safeStorage, app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

const GITHUB_CLIENT_ID = 'Ov23lie4GdL72zelKLfm';
const SERVICE_NAME = 'marix-ssh-client';
const ACCOUNT_NAME = 'github-oauth';
const REPO_NAME_KEY = 'github-repo-name';

// Secure storage using Electron's safeStorage
class SecureStore {
  private storePath: string;

  constructor() {
    this.storePath = path.join(app.getPath('userData'), '.secure-store');
  }

  private getFilePath(key: string): string {
    return path.join(this.storePath, `${key}.enc`);
  }

  async setPassword(service: string, account: string, password: string): Promise<void> {
    if (!fs.existsSync(this.storePath)) {
      fs.mkdirSync(this.storePath, { recursive: true });
    }
    const key = `${service}-${account}`;
    const encrypted = safeStorage.encryptString(password);
    fs.writeFileSync(this.getFilePath(key), encrypted);
  }

  async getPassword(service: string, account: string): Promise<string | null> {
    const key = `${service}-${account}`;
    const filePath = this.getFilePath(key);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    try {
      const encrypted = fs.readFileSync(filePath);
      return safeStorage.decryptString(encrypted);
    } catch {
      return null;
    }
  }

  async deletePassword(service: string, account: string): Promise<boolean> {
    const key = `${service}-${account}`;
    const filePath = this.getFilePath(key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }
}

const secureStore = new SecureStore();

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export interface TokenResponse {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

export interface GitHubUser {
  login: string;
  avatar_url: string;
  name: string;
}

export class GitHubAuthService {
  private pollingInterval: NodeJS.Timeout | null = null;

  /**
   * Request device code from GitHub
   */
  async requestDeviceCode(): Promise<{ success: boolean; data?: DeviceCodeResponse; error?: string }> {
    return new Promise((resolve) => {
      const postData = JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        scope: 'repo'
      });

      const options = {
        hostname: 'github.com',
        path: '/login/device/code',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (response.device_code) {
              resolve({ success: true, data: response });
            } else {
              resolve({ success: false, error: response.error_description || 'Failed to get device code' });
            }
          } catch (e) {
            resolve({ success: false, error: 'Failed to parse response' });
          }
        });
      });

      req.on('error', (e) => {
        resolve({ success: false, error: e.message });
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * Poll for access token after user authorizes
   */
  async pollForToken(deviceCode: string, interval: number = 5): Promise<{ success: boolean; token?: string; error?: string }> {
    return new Promise((resolve) => {
      let currentInterval = Math.max(interval, 5) * 1000; // Convert to ms, minimum 5 seconds
      
      const poll = () => {
        const postData = JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          device_code: deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
        });

        const options = {
          hostname: 'github.com',
          path: '/login/oauth/access_token',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          }
        };

        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', async () => {
            try {
              console.log('[GitHubAuth] Poll response:', data);
              const response: TokenResponse = JSON.parse(data);
              
              if (response.access_token) {
                // Success! Save token securely
                console.log('[GitHubAuth] Got access token!');
                await this.saveToken(response.access_token);
                if (this.pollingInterval) {
                  clearInterval(this.pollingInterval);
                  this.pollingInterval = null;
                }
                resolve({ success: true, token: response.access_token });
              } else if (response.error === 'authorization_pending') {
                // Keep polling
                console.log('[GitHubAuth] Waiting for user authorization...');
              } else if (response.error === 'slow_down') {
                // Increase interval - GitHub is asking us to slow down
                // Add 5 seconds to current interval
                currentInterval += 5000;
                console.log('[GitHubAuth] Slow down requested, increasing interval to', currentInterval / 1000, 'seconds');
                // Restart polling with new interval
                if (this.pollingInterval) {
                  clearInterval(this.pollingInterval);
                }
                this.pollingInterval = setInterval(poll, currentInterval);
              } else if (response.error === 'expired_token') {
                console.log('[GitHubAuth] Device code expired');
                if (this.pollingInterval) {
                  clearInterval(this.pollingInterval);
                  this.pollingInterval = null;
                }
                resolve({ success: false, error: 'Device code expired. Please try again.' });
              } else if (response.error === 'access_denied') {
                console.log('[GitHubAuth] Access denied');
                if (this.pollingInterval) {
                  clearInterval(this.pollingInterval);
                  this.pollingInterval = null;
                }
                resolve({ success: false, error: 'Access denied by user.' });
              } else if (response.error) {
                console.log('[GitHubAuth] Error:', response.error, response.error_description);
                if (this.pollingInterval) {
                  clearInterval(this.pollingInterval);
                  this.pollingInterval = null;
                }
                resolve({ success: false, error: response.error_description || response.error || 'Unknown error' });
              }
              // If no error and no token, keep polling (shouldn't happen)
            } catch (e) {
              console.error('[GitHubAuth] Parse error:', e, 'Data:', data);
            }
          });
        });

        req.on('error', (e) => {
          console.error('[GitHubAuth] Request error:', e);
        });

        req.write(postData);
        req.end();
      };

      // Start first poll immediately, then schedule interval
      poll();
      this.pollingInterval = setInterval(poll, currentInterval);

      // Timeout after 15 minutes
      setTimeout(() => {
        if (this.pollingInterval) {
          clearInterval(this.pollingInterval);
          this.pollingInterval = null;
          resolve({ success: false, error: 'Authorization timeout' });
        }
      }, 15 * 60 * 1000);
    });
  }

  /**
   * Stop polling
   */
  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  /**
   * Save token securely using Electron safeStorage
   */
  async saveToken(token: string): Promise<void> {
    await secureStore.setPassword(SERVICE_NAME, ACCOUNT_NAME, token);
    console.log('[GitHubAuth] Token saved securely');
  }

  /**
   * Get saved token
   */
  async getToken(): Promise<string | null> {
    return await secureStore.getPassword(SERVICE_NAME, ACCOUNT_NAME);
  }

  /**
   * Delete saved token
   */
  async deleteToken(): Promise<boolean> {
    return await secureStore.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
  }

  /**
   * Check if token exists
   */
  async hasToken(): Promise<boolean> {
    const token = await this.getToken();
    return token !== null;
  }

  /**
   * Verify token by calling GitHub API
   */
  async verifyToken(): Promise<{ valid: boolean; user?: GitHubUser; error?: string }> {
    const token = await this.getToken();
    if (!token) {
      return { valid: false, error: 'No token found' };
    }

    return new Promise((resolve) => {
      const options = {
        hostname: 'api.github.com',
        path: '/user',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'Arix-SSH-Client',
          'Accept': 'application/vnd.github+json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const user = JSON.parse(data);
              resolve({
                valid: true,
                user: {
                  login: user.login,
                  avatar_url: user.avatar_url,
                  name: user.name || user.login
                }
              });
            } catch (e) {
              resolve({ valid: false, error: 'Failed to parse response' });
            }
          } else if (res.statusCode === 401) {
            resolve({ valid: false, error: 'Token is invalid or expired' });
          } else {
            resolve({ valid: false, error: `GitHub API error: ${res.statusCode}` });
          }
        });
      });

      req.on('error', (e) => {
        resolve({ valid: false, error: e.message });
      });

      req.end();
    });
  }

  /**
   * Save repo name
   */
  async saveRepoName(repoName: string): Promise<void> {
    await secureStore.setPassword(SERVICE_NAME, REPO_NAME_KEY, repoName);
  }

  /**
   * Get saved repo name
   */
  async getRepoName(): Promise<string | null> {
    return await secureStore.getPassword(SERVICE_NAME, REPO_NAME_KEY);
  }

  /**
   * Create private backup repo
   */
  async createBackupRepo(repoName: string = 'arix-backup'): Promise<{ success: boolean; fullName?: string; error?: string }> {
    const token = await this.getToken();
    if (!token) {
      return { success: false, error: 'Not authenticated' };
    }

    return new Promise((resolve) => {
      const postData = JSON.stringify({
        name: repoName,
        private: true,
        description: 'Arix SSH Client Backup (Encrypted)',
        auto_init: true
      });

      const options = {
        hostname: 'api.github.com',
        path: '/user/repos',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'Arix-SSH-Client',
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', async () => {
          try {
            const response = JSON.parse(data);
            if (res.statusCode === 201) {
              await this.saveRepoName(response.full_name);
              resolve({ success: true, fullName: response.full_name });
            } else if (res.statusCode === 422 && response.errors?.some((e: any) => e.message?.includes('already exists'))) {
              // Repo already exists, get user info to build full name
              const userResult = await this.verifyToken();
              if (userResult.valid && userResult.user) {
                const fullName = `${userResult.user.login}/${repoName}`;
                await this.saveRepoName(fullName);
                resolve({ success: true, fullName });
              } else {
                resolve({ success: false, error: 'Repo exists but could not get user info' });
              }
            } else {
              resolve({ success: false, error: response.message || 'Failed to create repo' });
            }
          } catch (e) {
            resolve({ success: false, error: 'Failed to parse response' });
          }
        });
      });

      req.on('error', (e) => {
        resolve({ success: false, error: e.message });
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * List user's repos to select from
   */
  async listRepos(): Promise<{ success: boolean; repos?: { name: string; full_name: string; private: boolean }[]; error?: string }> {
    const token = await this.getToken();
    if (!token) {
      return { success: false, error: 'Not authenticated' };
    }

    return new Promise((resolve) => {
      const options = {
        hostname: 'api.github.com',
        path: '/user/repos?per_page=100&sort=updated',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'Arix-SSH-Client',
          'Accept': 'application/vnd.github+json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const repos = JSON.parse(data);
              resolve({
                success: true,
                repos: repos.map((r: any) => ({
                  name: r.name,
                  full_name: r.full_name,
                  private: r.private
                }))
              });
            } catch (e) {
              resolve({ success: false, error: 'Failed to parse response' });
            }
          } else {
            resolve({ success: false, error: `GitHub API error: ${res.statusCode}` });
          }
        });
      });

      req.on('error', (e) => {
        resolve({ success: false, error: e.message });
      });

      req.end();
    });
  }

  /**
   * Upload backup file to repo
   */
  async uploadBackup(content: string, message: string = 'Arix backup'): Promise<{ success: boolean; sha?: string; error?: string }> {
    const token = await this.getToken();
    const repoName = await this.getRepoName();
    
    if (!token) {
      return { success: false, error: 'Not authenticated' };
    }
    if (!repoName) {
      return { success: false, error: 'No repo selected' };
    }

    // First, try to get existing file SHA (needed for update)
    const existingSha = await this.getFileSha(repoName, 'backup.arix');

    return new Promise((resolve) => {
      const base64Content = Buffer.from(content).toString('base64');
      const postData = JSON.stringify({
        message,
        content: base64Content,
        ...(existingSha ? { sha: existingSha } : {})
      });

      const options = {
        hostname: 'api.github.com',
        path: `/repos/${repoName}/contents/backup.arix`,
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'Arix-SSH-Client',
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (res.statusCode === 200 || res.statusCode === 201) {
              console.log('[GitHubAuth] Backup uploaded successfully');
              resolve({ success: true, sha: response.content?.sha });
            } else {
              resolve({ success: false, error: response.message || 'Failed to upload backup' });
            }
          } catch (e) {
            resolve({ success: false, error: 'Failed to parse response' });
          }
        });
      });

      req.on('error', (e) => {
        resolve({ success: false, error: e.message });
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * Get file SHA (needed for updating existing file)
   */
  private async getFileSha(repoName: string, filePath: string): Promise<string | null> {
    const token = await this.getToken();
    if (!token) return null;

    return new Promise((resolve) => {
      const options = {
        hostname: 'api.github.com',
        path: `/repos/${repoName}/contents/${filePath}`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'Arix-SSH-Client',
          'Accept': 'application/vnd.github+json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const response = JSON.parse(data);
              resolve(response.sha || null);
            } catch (e) {
              resolve(null);
            }
          } else {
            resolve(null);
          }
        });
      });

      req.on('error', () => resolve(null));
      req.end();
    });
  }

  /**
   * Download backup file from repo
   */
  async downloadBackup(): Promise<{ success: boolean; content?: string; error?: string }> {
    const token = await this.getToken();
    const repoName = await this.getRepoName();
    
    if (!token) {
      return { success: false, error: 'Not authenticated' };
    }
    if (!repoName) {
      return { success: false, error: 'No repo selected' };
    }

    return new Promise((resolve) => {
      const options = {
        hostname: 'api.github.com',
        path: `/repos/${repoName}/contents/backup.arix`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'Arix-SSH-Client',
          'Accept': 'application/vnd.github+json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const response = JSON.parse(data);
              const content = Buffer.from(response.content, 'base64').toString('utf-8');
              resolve({ success: true, content });
            } catch (e) {
              resolve({ success: false, error: 'Failed to parse response' });
            }
          } else if (res.statusCode === 404) {
            resolve({ success: false, error: 'No backup found in repo' });
          } else {
            resolve({ success: false, error: `GitHub API error: ${res.statusCode}` });
          }
        });
      });

      req.on('error', (e) => {
        resolve({ success: false, error: e.message });
      });

      req.end();
    });
  }

  /**
   * Logout - delete token and repo name
   */
  async logout(): Promise<void> {
    await this.deleteToken();
    await secureStore.deletePassword(SERVICE_NAME, REPO_NAME_KEY);
    console.log('[GitHubAuth] Logged out');
  }
}
