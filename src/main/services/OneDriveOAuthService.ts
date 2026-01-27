import { BrowserWindow, shell, safeStorage, app } from 'electron';
import { randomBytes, createHash } from 'crypto';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import { OAuthCallbackServer } from './OAuthCallbackServer';

interface OneDriveTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  created_at: number;
  scope: string;
}

interface PKCEChallenge {
  verifier: string;
  challenge: string;
}

interface OneDriveCredentials {
  client_id: string;
}

/**
 * OneDrive OAuth2 Service with PKCE support
 * Uses Microsoft Identity Platform v2.0 endpoints
 * 
 * NOTE: OneDrive for personal accounts uses "consumers" tenant
 *       For work/school accounts, use "organizations" or specific tenant ID
 */
export class OneDriveOAuthService {
  // Microsoft Identity Platform v2.0 endpoints
  private static AUTH_URL = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize';
  private static TOKEN_URL = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token';
  
  private static currentChallenge: PKCEChallenge | null = null;
  private static currentRedirectUri: string | null = null;
  private static authWindow: BrowserWindow | null = null;
  private static callbackServer: OAuthCallbackServer | null = null;
  private static credentials: OneDriveCredentials | null = null;

  /**
   * Load OneDrive credentials from file
   */
  private static loadCredentials(): OneDriveCredentials | null {
    if (this.credentials) return this.credentials;

    const possiblePaths = [
      // When running from dist (packaged app - inside asar)
      path.join(__dirname, 'onedrive-credentials.json'),
      // When running from app.asar - dist structure
      path.join(app.getAppPath(), 'dist', 'main', 'services', 'onedrive-credentials.json'),
      // Development - from src
      path.join(__dirname, '..', '..', '..', 'src', 'main', 'services', 'onedrive-credentials.json'),
      path.join(app.getAppPath(), 'src', 'main', 'services', 'onedrive-credentials.json'),
      // User data directory (for manual override)
      path.join(app.getPath('userData'), 'onedrive-credentials.json'),
    ];

    for (const credPath of possiblePaths) {
      if (fs.existsSync(credPath)) {
        try {
          const content = fs.readFileSync(credPath, 'utf-8');
          const creds = JSON.parse(content) as OneDriveCredentials;
          
          // Check if credentials are valid (not placeholders)
          if (creds.client_id && !creds.client_id.startsWith('PLACEHOLDER')) {
            this.credentials = creds;
            console.log('[OneDrive OAuth] Loaded credentials from:', credPath);
            return creds;
          }
        } catch (e) {
          console.error('[OneDrive OAuth] Error loading credentials:', e);
        }
      }
    }

    console.warn('[OneDrive OAuth] No valid credentials found');
    return null;
  }

  /**
   * Check if valid credentials are configured
   */
  static hasCredentials(): boolean {
    const creds = this.loadCredentials();
    console.log('[OneDrive OAuth] hasCredentials:', creds !== null);
    return creds !== null;
  }

  /**
   * Get client ID
   */
  private static getClientId(): string {
    const creds = this.loadCredentials();
    if (!creds) throw new Error('OneDrive credentials not configured');
    return creds.client_id;
  }

  /**
   * Generate PKCE code verifier and challenge
   * Per RFC 7636: verifier is 43-128 chars, challenge is SHA256 hash base64url encoded
   */
  private static generatePKCE(): PKCEChallenge {
    // Generate random 64-byte string for verifier
    const verifier = randomBytes(64).toString('base64url');
    
    // Generate SHA256 hash and encode as base64url for challenge
    const hash = createHash('sha256').update(verifier).digest();
    const challenge = hash.toString('base64url');
    
    return { verifier, challenge };
  }

  /**
   * Start OAuth flow with PKCE
   * Opens browser for user to authenticate
   */
  static async startOAuthFlow(parentWindow?: BrowserWindow): Promise<OneDriveTokens> {
    try {
      // Generate PKCE challenge
      this.currentChallenge = this.generatePKCE();
      
      // Create callback server with random port
      // Using 127.0.0.1 for RFC 8252 compliance (allows any port for native apps)
      this.callbackServer = new OAuthCallbackServer({
        serviceName: 'OneDrive',
        serviceColor: '#0078d4, #0066b8',
        callbackPath: '/callback',
        useLoopbackIP: true  // RFC 8252: 127.0.0.1 allows any port for native clients
      });
      
      // Start server and wait for port assignment
      await this.callbackServer.startServer();
      
      // Get the callback URL with the assigned port
      this.currentRedirectUri = this.callbackServer.getCallbackUrl();
      console.log('[OneDrive OAuth] Using callback URL:', this.currentRedirectUri);
      
      // Build authorization URL with PKCE
      // Microsoft supports: openid, offline_access, Files.ReadWrite, User.Read
      const authUrl = new URL(this.AUTH_URL);
      authUrl.searchParams.set('client_id', this.getClientId());
      authUrl.searchParams.set('redirect_uri', this.currentRedirectUri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('response_mode', 'query');
      authUrl.searchParams.set('scope', 'openid offline_access Files.ReadWrite User.Read');
      authUrl.searchParams.set('code_challenge', this.currentChallenge.challenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');
      
      console.log('[OneDrive OAuth] Opening authorization URL');
      
      // Open in external browser
      await shell.openExternal(authUrl.toString());
      
      // Wait for authorization code from callback
      const { code } = await this.callbackServer.start();
      
      // Exchange code for tokens
      const tokens = await this.exchangeCodeForToken(code);
      
      return tokens;
    } catch (error) {
      this.cleanup();
      throw error;
    }
  }

  /**
   * Exchange authorization code for access token using PKCE
   * Note: Public clients (native apps) don't send client_secret with PKCE
   */
  private static async exchangeCodeForToken(code: string): Promise<OneDriveTokens> {
    if (!this.currentChallenge) {
      throw new Error('No PKCE challenge found');
    }
    
    if (!this.currentRedirectUri) {
      throw new Error('No redirect URI found');
    }

    return new Promise((resolve, reject) => {
      // Public clients with PKCE don't need client_secret
      const postData = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        client_id: this.getClientId(),
        redirect_uri: this.currentRedirectUri!,
        code_verifier: this.currentChallenge!.verifier,
      }).toString();

      const url = new URL(this.TOKEN_URL);
      const options: https.RequestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
        },
      };

      console.log('[OneDrive OAuth] Exchanging code for token...');

      const req = https.request(url, options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          console.log('[OneDrive OAuth] Token exchange response status:', res.statusCode);
          
          if (res.statusCode === 200) {
            try {
              const tokens = JSON.parse(data);
              tokens.created_at = Math.floor(Date.now() / 1000);
              console.log('[OneDrive OAuth] Token received successfully');
              this.cleanup();
              resolve(tokens);
            } catch (error) {
              console.error('[OneDrive OAuth] Failed to parse token response:', error);
              this.cleanup();
              reject(new Error('Failed to parse token response'));
            }
          } else {
            console.error('[OneDrive OAuth] Token exchange failed:', data);
            this.cleanup();
            try {
              const errorData = JSON.parse(data);
              reject(new Error(errorData.error_description || errorData.error || 'Token exchange failed'));
            } catch {
              reject(new Error(`Token exchange failed with status ${res.statusCode}`));
            }
          }
        });
      });

      req.on('error', (error) => {
        console.error('[OneDrive OAuth] Request error:', error);
        this.cleanup();
        reject(error);
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * Refresh access token using refresh token
   * Public clients with PKCE don't need client_secret for refresh
   */
  private static async refreshAccessToken(refreshToken: string): Promise<OneDriveTokens> {
    return new Promise((resolve, reject) => {
      const postData = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.getClientId(),
        scope: 'openid offline_access Files.ReadWrite User.Read',
      }).toString();

      const url = new URL(this.TOKEN_URL);
      const options: https.RequestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
        },
      };

      console.log('[OneDrive OAuth] Refreshing access token...');

      const req = https.request(url, options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const tokens = JSON.parse(data);
              tokens.created_at = Math.floor(Date.now() / 1000);
              console.log('[OneDrive OAuth] Token refreshed successfully');
              resolve(tokens);
            } catch (error) {
              console.error('[OneDrive OAuth] Failed to parse refresh response:', error);
              reject(new Error('Failed to parse refresh response'));
            }
          } else {
            console.error('[OneDrive OAuth] Token refresh failed:', data);
            reject(new Error('Failed to refresh token'));
          }
        });
      });

      req.on('error', (error) => {
        console.error('[OneDrive OAuth] Refresh request error:', error);
        reject(error);
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * Save tokens securely using Electron safeStorage
   */
  static saveTokens(tokens: OneDriveTokens): void {
    try {
      const encryptedData = safeStorage.encryptString(JSON.stringify(tokens));
      
      const userDataPath = app.getPath('userData');
      const tokenPath = path.join(userDataPath, 'onedrive-tokens.enc');
      
      fs.writeFileSync(tokenPath, encryptedData);
      console.log('[OneDrive OAuth] Tokens saved successfully');
    } catch (error) {
      console.error('[OneDrive OAuth] Failed to save tokens:', error);
      throw error;
    }
  }

  /**
   * Load tokens from secure storage
   */
  static loadTokens(): OneDriveTokens | null {
    try {
      const userDataPath = app.getPath('userData');
      const tokenPath = path.join(userDataPath, 'onedrive-tokens.enc');
      
      if (!fs.existsSync(tokenPath)) {
        console.log('[OneDrive OAuth] No tokens found');
        return null;
      }
      
      const encryptedData = fs.readFileSync(tokenPath);
      const decryptedData = safeStorage.decryptString(encryptedData);
      const tokens = JSON.parse(decryptedData);
      
      console.log('[OneDrive OAuth] Tokens loaded successfully');
      return tokens;
    } catch (error) {
      console.error('[OneDrive OAuth] Failed to load tokens:', error);
      return null;
    }
  }

  /**
   * Delete stored tokens (logout)
   */
  static deleteTokens(): void {
    try {
      const userDataPath = app.getPath('userData');
      const tokenPath = path.join(userDataPath, 'onedrive-tokens.enc');
      
      if (fs.existsSync(tokenPath)) {
        fs.unlinkSync(tokenPath);
        console.log('[OneDrive OAuth] Tokens deleted');
      }
    } catch (error) {
      console.error('[OneDrive OAuth] Failed to delete tokens:', error);
      throw error;
    }
  }

  /**
   * Check if tokens are valid and refresh if needed
   */
  static async getValidAccessToken(): Promise<string | null> {
    try {
      const tokens = this.loadTokens();
      if (!tokens) {
        console.log('[OneDrive OAuth] No tokens found');
        return null;
      }

      const now = Math.floor(Date.now() / 1000);
      const expiresAt = tokens.created_at + tokens.expires_in;
      const timeUntilExpiry = expiresAt - now;

      console.log('[OneDrive OAuth] Token expires in', timeUntilExpiry, 'seconds');

      // If token expires in less than 5 minutes, refresh it
      if (timeUntilExpiry < 300) {
        console.log('[OneDrive OAuth] Token expiring soon, refreshing...');
        const newTokens = await this.refreshAccessToken(tokens.refresh_token);
        this.saveTokens(newTokens);
        return newTokens.access_token;
      }

      console.log('[OneDrive OAuth] Token is valid');
      return tokens.access_token;
    } catch (error) {
      console.error('[OneDrive OAuth] Error getting valid token:', error);
      return null;
    }
  }

  /**
   * Handle manual code submission (fallback)
   */
  static handleManualCode(code: string): void {
    if ((global as any).onedriveOAuthResolver) {
      console.log('[OneDrive OAuth] Manual code submitted');
      (global as any).onedriveOAuthResolver(code);
    }
  }

  /**
   * Cleanup resources
   */
  private static cleanup(): void {
    if (this.callbackServer) {
      this.callbackServer.stop();
      this.callbackServer = null;
    }
    if (this.authWindow && !this.authWindow.isDestroyed()) {
      this.authWindow.close();
      this.authWindow = null;
    }
    this.currentChallenge = null;
    this.currentRedirectUri = null;
  }
}
