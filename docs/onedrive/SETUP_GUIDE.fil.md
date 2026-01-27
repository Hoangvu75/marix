# Gabay sa Pag-setup ng Microsoft OneDrive OAuth2

Ang gabay na ito ay tutulong sa iyo na i-setup ang OneDrive OAuth2 authentication para sa Marix.

## Mga Kinakailangan

- Personal na Microsoft account
- Access sa [Azure Portal](https://portal.azure.com)

## Hakbang 1: Magrehistro ng Bagong Application

1. Pumunta sa [Azure Portal - App registrations](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
2. I-click ang **"New registration"**
3. Punan ang mga detalye:
   - **Name**: `Marix SSH Client`
   - **Supported account types**: Piliin ang **"Personal Microsoft accounts only"**
   - **Redirect URI**: Iwanang blangko (idadagdag sa hakbang 3)
4. I-click ang **"Register"**

## Hakbang 2: I-note ang Application ID

Pagkatapos ng registration:
1. Kopyahin ang **Application (client) ID**
2. I-save sa ligtas na lugar

## Hakbang 3: I-configure ang Authentication (Random Port)

Gumagamit ang Marix ng **RFC 8252** compliant loopback redirect na may random ports para sa seguridad.

1. I-click ang **"Authentication"**
2. Sa **"Platform configurations"**, i-click ang **"Add a platform"**
3. Piliin ang **"Mobile and desktop applications"**
4. ⚠️ **Importante**: Magdagdag ng MARAMING redirect URIs:
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
5. I-check din: `https://login.microsoftonline.com/common/oauth2/nativeclient`
6. Sa **"Advanced settings"**:
   - I-set ang **"Allow public client flows"** sa **Yes** ⚠️
7. I-click ang **"Save"**

## Hakbang 4: I-configure ang API Permissions

1. I-click ang **"API permissions"**
2. I-click ang **"Add a permission"**
3. Piliin ang **"Microsoft Graph"** → **"Delegated permissions"**
4. Idagdag:
   - ✅ `Files.ReadWrite`
   - ✅ `User.Read`
   - ✅ `offline_access`
5. I-click ang **"Add permissions"**

## Hakbang 5: Gumawa ng Credentials File

**Para sa lokal na development**: I-edit ang `src/main/services/onedrive-credentials.json`:

```json
{
  "client_id": "IYONG_CLIENT_ID"
}
```

**Para sa CI/CD builds**: Gumamit ng GitHub Secrets (tingnan sa ibaba)

## Hakbang 6: I-configure sa Marix

### Opsyon A: Lokal na Development

1. Gumawa ng `onedrive-credentials.json` file sa `src/main/services/` folder
2. **MAHALAGA**: Idagdag sa `.gitignore`:
```
src/main/services/onedrive-credentials.json
```

### Opsyon B: CI/CD gamit ang GitHub Secrets (Inirerekumenda)

1. Pumunta sa iyong GitHub repository → **Settings** → **Secrets and variables** → **Actions**
2. Idagdag ang secret na ito:
   - `ONEDRIVE_CLIENT_ID`: Iyong OAuth Application (Client) ID
3. Ang build workflow ay awtomatikong mag-inject ng credentials sa panahon ng build

## Hakbang 7: Mag-build at Mag-test

```bash
npm run build
npm start
```

## Mga Tala sa Seguridad

- ✅ **PKCE**: Hindi kailangan ng client_secret
- ✅ **RFC 8252**: Loopback redirect na may random ports
- ✅ **E2E Encryption**: Argon2id + AES-256-GCM
- 📁 **Lokasyon ng storage**: `/Marix/backup.marix`
- Gumamit ng **GitHub Secrets** para sa CI/CD builds para protektahan ang credentials
