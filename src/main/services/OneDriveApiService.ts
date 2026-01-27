import * as https from 'https';
import { OneDriveOAuthService } from './OneDriveOAuthService';

interface OneDriveUser {
  id: string;
  displayName: string;
  mail?: string;
  userPrincipalName: string;
}

interface OneDriveItem {
  id: string;
  name: string;
  folder?: { childCount: number };
  file?: { mimeType: string };
  size?: number;
  lastModifiedDateTime: string;
}

interface DriveInfo {
  id: string;
  driveType: string;
  quota: {
    used: number;
    total: number;
    remaining: number;
  };
}

/**
 * OneDrive API Service for backup operations
 * Uses Microsoft Graph API v1.0
 */
export class OneDriveApiService {
  private static readonly GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';
  private static readonly BACKUP_FOLDER_NAME = 'Marix';
  private static readonly BACKUP_FILE_NAME = 'backup.marix';

  /**
   * Make authenticated API request to Microsoft Graph
   */
  private static async apiRequest<T>(
    method: string,
    endpoint: string,
    accessToken: string,
    body?: any
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const fullUrl = `${this.GRAPH_API_BASE}${endpoint}`;
      console.log('[OneDrive API] Request:', method, fullUrl);
      const url = new URL(fullUrl);
      
      const options: https.RequestOptions = {
        method,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      };

      const req = https.request(url, options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          console.log('[OneDrive API] Response status:', res.statusCode);
          
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              // Handle empty responses (204 No Content)
              if (!data || data.trim() === '') {
                resolve({} as T);
                return;
              }
              
              const contentType = res.headers['content-type'] || '';
              if (contentType.includes('application/json')) {
                const result = JSON.parse(data);
                resolve(result);
              } else {
                console.error('[OneDrive API] Expected JSON but got:', contentType);
                console.error('[OneDrive API] Response preview:', data.substring(0, 200));
                reject(new Error('OneDrive API returned non-JSON response. Check token validity.'));
              }
            } catch (error) {
              console.error('[OneDrive API] Failed to parse response:', error);
              reject(error);
            }
          } else {
            console.error('[OneDrive API] Request failed:', data);
            try {
              const errorData = JSON.parse(data);
              const errorMsg = errorData.error?.message || errorData.error_description || `OneDrive API error: ${res.statusCode}`;
              reject(new Error(errorMsg));
            } catch {
              reject(new Error(`OneDrive API request failed with status ${res.statusCode}`));
            }
          }
        });
      });

      req.on('error', (error) => {
        console.error('[OneDrive API] Request error:', error);
        reject(error);
      });

      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  }

  /**
   * Get current authenticated user info
   */
  static async getCurrentUser(accessToken: string): Promise<OneDriveUser> {
    return this.apiRequest<OneDriveUser>('GET', '/me', accessToken);
  }

  /**
   * Get user's drive info (storage quota, drive type)
   */
  static async getDriveInfo(accessToken: string): Promise<DriveInfo> {
    return this.apiRequest<DriveInfo>('GET', '/me/drive', accessToken);
  }

  /**
   * Get or create Marix backup folder in OneDrive root
   * Uses special folder paths: /me/drive/root:/path/to/folder
   */
  static async getOrCreateBackupFolder(accessToken: string): Promise<OneDriveItem> {
    try {
      console.log('[OneDrive API] Looking for Marix folder in root...');
      
      // Try to get the folder first using path-based addressing
      try {
        const folder = await this.apiRequest<OneDriveItem>(
          'GET',
          `/me/drive/root:/${this.BACKUP_FOLDER_NAME}`,
          accessToken
        );
        
        if (folder && folder.id && folder.folder) {
          console.log('[OneDrive API] Found existing Marix folder:', folder.id);
          return folder;
        }
      } catch (e: any) {
        // Folder doesn't exist, we'll create it
        console.log('[OneDrive API] Marix folder not found, will create...');
      }
      
      // Create the folder
      console.log('[OneDrive API] Creating Marix folder...');
      const newFolder = await this.apiRequest<OneDriveItem>(
        'POST',
        '/me/drive/root/children',
        accessToken,
        {
          name: this.BACKUP_FOLDER_NAME,
          folder: {},
          '@microsoft.graph.conflictBehavior': 'fail'
        }
      );
      
      console.log('[OneDrive API] Created Marix folder:', newFolder.id);
      return newFolder;
    } catch (err: any) {
      // If conflict (folder already exists), try to get it again
      if (err.message?.includes('nameAlreadyExists')) {
        const folder = await this.apiRequest<OneDriveItem>(
          'GET',
          `/me/drive/root:/${this.BACKUP_FOLDER_NAME}`,
          accessToken
        );
        return folder;
      }
      console.error('[OneDrive API] Error getting/creating folder:', err);
      throw err;
    }
  }

  /**
   * Get backup file if it exists
   */
  static async getBackupFile(accessToken: string): Promise<OneDriveItem | null> {
    try {
      const file = await this.apiRequest<OneDriveItem>(
        'GET',
        `/me/drive/root:/${this.BACKUP_FOLDER_NAME}/${this.BACKUP_FILE_NAME}`,
        accessToken
      );
      
      if (file && file.id && file.file) {
        console.log('[OneDrive API] Found backup file:', file.id);
        return file;
      }
      return null;
    } catch (e) {
      // File doesn't exist
      return null;
    }
  }

  /**
   * Check if backup exists
   */
  static async backupExists(accessToken: string): Promise<boolean> {
    const file = await this.getBackupFile(accessToken);
    return file !== null;
  }

  /**
   * Get backup metadata (last modified, size)
   */
  static async getBackupMetadata(accessToken: string): Promise<{ modified_at: string; size: number } | null> {
    const file = await this.getBackupFile(accessToken);
    if (!file) return null;
    
    return {
      modified_at: file.lastModifiedDateTime,
      size: file.size || 0
    };
  }

  /**
   * Upload backup file to OneDrive
   * Uses simple upload for files < 4MB, or resumable upload for larger files
   * For backup files, simple upload should be sufficient
   */
  static async uploadBackup(accessToken: string, content: string): Promise<OneDriveItem> {
    // Ensure folder exists
    await this.getOrCreateBackupFolder(accessToken);
    
    console.log('[OneDrive API] Uploading backup file...');
    
    // Use PUT to upload/replace file content
    // Path: /me/drive/root:/Marix/backup.marix:/content
    const uploadPath = `/me/drive/root:/${this.BACKUP_FOLDER_NAME}/${this.BACKUP_FILE_NAME}:/content`;
    
    return new Promise((resolve, reject) => {
      const fullUrl = `${this.GRAPH_API_BASE}${uploadPath}`;
      const url = new URL(fullUrl);
      const contentBuffer = Buffer.from(content, 'utf-8');
      
      const options: https.RequestOptions = {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/octet-stream',
          'Content-Length': contentBuffer.length
        }
      };

      console.log('[OneDrive API] Uploading to:', uploadPath);

      const req = https.request(url, options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          console.log('[OneDrive API] Upload response status:', res.statusCode);
          
          if (res.statusCode && (res.statusCode === 200 || res.statusCode === 201)) {
            try {
              const result = JSON.parse(data);
              console.log('[OneDrive API] Backup uploaded successfully');
              resolve(result);
            } catch (error) {
              console.error('[OneDrive API] Failed to parse upload response:', error);
              reject(new Error('Failed to parse upload response'));
            }
          } else {
            console.error('[OneDrive API] Upload failed:', data);
            try {
              const errorData = JSON.parse(data);
              reject(new Error(errorData.error?.message || 'Upload failed'));
            } catch {
              reject(new Error(`Upload failed with status ${res.statusCode}`));
            }
          }
        });
      });

      req.on('error', (error) => {
        console.error('[OneDrive API] Upload error:', error);
        reject(error);
      });

      req.write(contentBuffer);
      req.end();
    });
  }

  /**
   * Download backup file from OneDrive
   */
  static async downloadBackup(accessToken: string): Promise<string> {
    console.log('[OneDrive API] Downloading backup file...');
    
    // First get the download URL
    const file = await this.getBackupFile(accessToken);
    if (!file) {
      throw new Error('No backup file found on OneDrive');
    }
    
    // Download using item ID
    // The @microsoft.graph.downloadUrl is available in the file metadata
    const downloadPath = `/me/drive/items/${file.id}/content`;
    
    return new Promise((resolve, reject) => {
      const fullUrl = `${this.GRAPH_API_BASE}${downloadPath}`;
      const url = new URL(fullUrl);
      
      const options: https.RequestOptions = {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      };

      console.log('[OneDrive API] Downloading from:', downloadPath);

      const makeRequest = (requestUrl: URL, redirectCount: number = 0) => {
        if (redirectCount > 5) {
          reject(new Error('Too many redirects'));
          return;
        }

        const protocol = requestUrl.protocol === 'https:' ? https : require('http');
        
        const req = protocol.request(requestUrl, options, (res: any) => {
          // Handle redirects (302, 307)
          if (res.statusCode === 302 || res.statusCode === 307) {
            const redirectUrl = res.headers.location;
            if (redirectUrl) {
              console.log('[OneDrive API] Following redirect to download URL');
              // For redirects, don't send auth header
              options.headers = {};
              makeRequest(new URL(redirectUrl), redirectCount + 1);
              return;
            }
          }
          
          let data = '';
          res.on('data', (chunk: any) => (data += chunk));
          res.on('end', () => {
            console.log('[OneDrive API] Download response status:', res.statusCode);
            
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              console.log('[OneDrive API] Backup downloaded successfully');
              resolve(data);
            } else {
              console.error('[OneDrive API] Download failed:', data.substring(0, 500));
              reject(new Error(`Download failed with status ${res.statusCode}`));
            }
          });
        });

        req.on('error', (error: any) => {
          console.error('[OneDrive API] Download error:', error);
          reject(error);
        });

        req.end();
      };

      makeRequest(url);
    });
  }

  /**
   * Delete backup file from OneDrive
   */
  static async deleteBackup(accessToken: string): Promise<void> {
    const file = await this.getBackupFile(accessToken);
    if (!file) {
      console.log('[OneDrive API] No backup file to delete');
      return;
    }
    
    console.log('[OneDrive API] Deleting backup file...');
    
    await this.apiRequest<void>(
      'DELETE',
      `/me/drive/items/${file.id}`,
      accessToken
    );
    
    console.log('[OneDrive API] Backup file deleted');
  }
}
