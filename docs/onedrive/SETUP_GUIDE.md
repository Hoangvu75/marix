# Microsoft OneDrive OAuth2 Setup Guide

This guide walks you through setting up Microsoft OneDrive OAuth2 authentication for Marix backup/restore functionality.

## Prerequisites

- A Microsoft account (personal)
- Access to [Microsoft Azure Portal](https://portal.azure.com)

## Step 1: Register a New Application

1. Go to [Azure Portal - App registrations](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
2. Click **"New registration"**
3. Fill in the application details:
   - **Name**: `Marix SSH Client`
   - **Supported account types**: Select **"Personal Microsoft accounts only"**
   - **Redirect URI**: Leave empty for now (we'll add it in step 3)
4. Click **"Register"**

## Step 2: Note Your Application (Client) ID

After registration, you'll see the overview page:

1. Copy the **Application (client) ID**
2. Save it somewhere safe

Example: `12345678-abcd-1234-5678-abcdefghijkl`

## Step 3: Configure Authentication (Random Port Support)

Marix uses **RFC 8252** compliant loopback redirect with random ports for security.

1. In the left sidebar, click **"Authentication"**
2. Under **"Platform configurations"**, click **"Add a platform"**
3. Select **"Mobile and desktop applications"**
4. ⚠️ **Important**: Add MULTIPLE redirect URIs for random port support:
   ```
   http://127.0.0.1/callback
   http://127.0.0.1:8888/callback
   http://127.0.0.1:8889/callback
   http://127.0.0.1:8890/callback
   http://127.0.0.1:8891/callback
   http://127.0.0.1:8892/callback
   http://127.0.0.1:8893/callback
   http://127.0.0.1:8894/callback
   http://127.0.0.1:8895/callback
   http://127.0.0.1:8896/callback
   http://127.0.0.1:8897/callback
   ```
5. Also check the box for: `https://login.microsoftonline.com/common/oauth2/nativeclient`
6. Under **"Advanced settings"**:
   - Set **"Allow public client flows"** to **Yes** ⚠️ (required for PKCE)
7. Click **"Save"**

> **Why random ports?** Per RFC 8252, native apps should use loopback redirects (127.0.0.1) with dynamic port selection. This prevents port conflicts and improves security.

## Step 4: Configure API Permissions

1. In the left sidebar, click **"API permissions"**
2. Click **"Add a permission"**
3. Select **"Microsoft Graph"**
4. Select **"Delegated permissions"**
5. Add the following permissions:
   - ✅ `Files.ReadWrite` - Read and write user's files
   - ✅ `User.Read` - Sign in and read user profile
   - ✅ `offline_access` - For refresh token
6. Click **"Add permissions"**

## Step 5: Create Credentials JSON File

**For local development**: Edit `src/main/services/onedrive-credentials.json`:

```json
{
  "client_id": "YOUR_APPLICATION_CLIENT_ID"
}
```

That's it! No redirect_uri needed - Marix handles it automatically with random ports.

**For CI/CD builds**: Use GitHub Secrets (see below)

## Step 6: Configure in Marix

### Option A: Local Development

1. Create `onedrive-credentials.json` file in `src/main/services/` folder
2. **IMPORTANT**: Add to `.gitignore`:
```
src/main/services/onedrive-credentials.json
```

### Option B: CI/CD with GitHub Secrets (Recommended)

1. Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions**
2. Add this secret:
   - `ONEDRIVE_CLIENT_ID`: Your OAuth Application (Client) ID
3. The build workflow will automatically inject credentials during build

## Step 7: Build and Test

```bash
npm run build
npm start
```

1. Go to **Settings** → **Backup & Restore**
2. Click the **OneDrive** tab
3. Click **"Connect to OneDrive"**
4. Sign in with your Microsoft account
5. You should see "Connected to OneDrive"

## Troubleshooting

### Error: "AADSTS50011: The reply URL does not match"

**Solution**: Add more redirect URIs in Azure Authentication settings. Make sure you have URIs for ports 8888-8897.

### Error: "AADSTS7000218: request body must contain client_secret"

**Solution**: 
1. Go to **Authentication** settings
2. Enable **"Allow public client flows"** → **Yes**
3. Save and try again

### Error: "Request failed with status 403"

**Solution**: Check that `Files.ReadWrite` permission is added and granted.

## Security Notes

- ✅ **PKCE**: Marix uses PKCE, no client_secret required
- ✅ **RFC 8252**: Uses loopback redirect (127.0.0.1) with random ports
- ✅ **E2E Encryption**: Data encrypted with Argon2id + AES-256-GCM before upload
- 📁 **Storage**: `/Marix/backup.marix` in your OneDrive
- Use **GitHub Secrets** for CI/CD builds to protect credentials
