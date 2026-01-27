# Gabay sa Pag-setup ng Google Drive Backup

> **Wika**: [🇺🇸 English](GOOGLE_DRIVE_SETUP.en.md) | [🇻🇳 Tiếng Việt](GOOGLE_DRIVE_SETUP.vi.md) | [🇮🇩 Bahasa Indonesia](GOOGLE_DRIVE_SETUP.id.md) | [🇨🇳 中文](GOOGLE_DRIVE_SETUP.zh.md) | [🇰🇷 한국어](GOOGLE_DRIVE_SETUP.ko.md) | [🇯🇵 日本語](GOOGLE_DRIVE_SETUP.ja.md) | [🇫🇷 Français](GOOGLE_DRIVE_SETUP.fr.md) | [🇩🇪 Deutsch](GOOGLE_DRIVE_SETUP.de.md) | [🇪🇸 Español](GOOGLE_DRIVE_SETUP.es.md) | [🇹🇭 ภาษาไทย](GOOGLE_DRIVE_SETUP.th.md) | [🇲🇾 Bahasa Melayu](GOOGLE_DRIVE_SETUP.ms.md) | [🇷🇺 Русский](GOOGLE_DRIVE_SETUP.ru.md) | [🇵🇭 Filipino](GOOGLE_DRIVE_SETUP.fil.md) | [🇧🇷 Português](GOOGLE_DRIVE_SETUP.pt.md)

---

## Hakbang 1: Lumikha ng Google Cloud Project

1. Pumunta sa [Google Cloud Console](https://console.cloud.google.com/)
2. I-click ang **"Bagong Proyekto"** sa kanang sulok sa itaas
3. Pangalanan ang iyong proyekto: `Marix SSH Client` o anumang pangalan na gusto mo
4. I-click ang **"Lumikha"**

## Hakbang 2: I-enable ang Google Drive API

1. Sa iyong bagong proyekto, pumunta sa **"API at Serbisyo"** > **"Library"**
2. Hanapin ang **"Google Drive API"**
3. I-click ang resulta at pindutin ang **"I-enable"**

## Hakbang 3: Lumikha ng OAuth 2.0 Credentials

### 3.1. I-configure ang OAuth Consent Screen

1. Pumunta sa **"API at Serbisyo"** > **"OAuth consent screen"**
2. Piliin ang **"External"** (pinapayagan ang lahat ng Google account user)
3. I-click ang **"Lumikha"**

**Impormasyon ng app:**
- Pangalan ng app: `Marix SSH Client`
- Email ng suporta sa user: `your-email@gmail.com`
- Logo ng app: (opsyonal)
- Homepage ng aplikasyon: `https://github.com/marixdev/marix`

**Impormasyon ng developer:**
- Mga email address: `your-email@gmail.com`

4. I-click ang **"I-save at magpatuloy"**

**Mga Scope:**
5. I-click ang **"Magdagdag o mag-alis ng mga scope"**
6. Hanapin at piliin:
   - `https://www.googleapis.com/auth/drive.file`
7. I-click ang **"I-update"** at **"I-save at magpatuloy"**

### 3.2. Lumikha ng OAuth Client ID

1. Pumunta sa **"API at Serbisyo"** > **"Credentials"**
2. I-click ang **"Lumikha ng credentials"** > **"OAuth client ID"**
3. Piliin ang **"Desktop app"**
4. Pangalanan: `Marix Desktop Client`
5. I-click ang **"Lumikha"**

6. **I-download ang JSON file**: I-click ang download icon
7. **Para sa lokal na development**: Lumikha ng `google-credentials.json` sa `src/main/services/`:
```json
{
  "installed": {
    "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
    "client_secret": "YOUR_CLIENT_SECRET"
  }
}
```

8. **Para sa CI/CD builds**: Gumamit ng GitHub Secrets (tingnan sa ibaba)

## Hakbang 4: I-configure sa Marix

### Opsyon A: Lokal na Development

1. Kopyahin ang `google-credentials.json` file sa `src/main/services/` folder
2. **MAHALAGA**: Idagdag sa `.gitignore`:
```
src/main/services/google-credentials.json
```

### Opsyon B: CI/CD gamit ang GitHub Secrets (Inirerekumenda)

1. Pumunta sa iyong GitHub repository → **Settings** → **Secrets and variables** → **Actions**
2. Idagdag ang mga secrets na ito:
   - `GOOGLE_CLIENT_ID`: Iyong OAuth Client ID
   - `GOOGLE_CLIENT_SECRET`: Iyong OAuth Client Secret
3. Ang build workflow ay awtomatikong mag-inject ng credentials sa panahon ng build

## Hakbang 5: I-test ang OAuth Flow

1. Buksan ang Marix app
2. Pumunta sa **Settings** > **Backup & Restore**
3. Piliin ang **"Google Drive"** tab
4. I-click ang **"Kumonekta sa Google Drive"**
5. Magbubukas ang browser na may Google OAuth screen
6. Piliin ang iyong Google account at magbigay ng mga pahintulot
7. Matatanggap ng app ang token at magpapakita ng "Nakakonekta"

## Mga Tala sa Seguridad

- **HUWAG** i-commit ang `google-credentials.json` sa Git
- Gumamit ng **GitHub Secrets** para sa CI/CD builds para protektahan ang client_secret
- Ang mga refresh token ay naka-store sa Electron store (naka-encrypt)
- PKCE ay ginagamit para sa karagdagang seguridad ng OAuth

## I-publish ang App (Kinakailangan)

1. Pumunta sa **OAuth consent screen**
2. I-click ang **"I-publish ang app"**
3. Agad na maaaprobahan ang iyong app
4. Kahit sino ay makakagamit nito nang walang "unverified app" na babala

## Pag-troubleshoot

### Error: "Access blocked: This app's request is invalid"
- Suriin na ang OAuth consent screen ay ganap na na-configure

### Error: "The OAuth client was not found"
- I-verify ang Client ID sa credentials file
- I-download muli ang JSON file mula sa Google Cloud Console

### Error: "Access denied"
- Tinanggihan ng user ang pagbibigay ng pahintulot
