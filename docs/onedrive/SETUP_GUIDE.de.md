# Microsoft OneDrive OAuth2 Einrichtungsanleitung

Diese Anleitung führt Sie durch die Einrichtung der OneDrive OAuth2-Authentifizierung für Marix.

## Voraussetzungen

- Ein persönliches Microsoft-Konto
- Zugang zum [Azure Portal](https://portal.azure.com)

## Schritt 1: Neue Anwendung registrieren

1. Gehen Sie zu [Azure Portal - App-Registrierungen](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
2. Klicken Sie auf **"Neue Registrierung"**
3. Füllen Sie die Details aus:
   - **Name**: `Marix SSH Client`
   - **Unterstützte Kontotypen**: Wählen Sie **"Nur persönliche Microsoft-Konten"**
   - **Umleitungs-URI**: Leer lassen (wird in Schritt 3 hinzugefügt)
4. Klicken Sie auf **"Registrieren"**

## Schritt 2: Anwendungs-ID notieren

Nach der Registrierung:
1. Kopieren Sie die **Anwendungs-ID (Client-ID)**
2. Speichern Sie sie sicher

## Schritt 3: Authentifizierung konfigurieren (Random Port)

Marix verwendet **RFC 8252** konforme Loopback-Umleitung mit zufälligen Ports.

1. Klicken Sie auf **"Authentifizierung"**
2. Unter **"Plattformkonfigurationen"**, klicken Sie auf **"Plattform hinzufügen"**
3. Wählen Sie **"Mobile und Desktopanwendungen"**
4. ⚠️ **Wichtig**: Fügen Sie MEHRERE Umleitungs-URIs hinzu:
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
5. Aktivieren Sie auch: `https://login.microsoftonline.com/common/oauth2/nativeclient`
6. Unter **"Erweiterte Einstellungen"**:
   - Setzen Sie **"Öffentliche Clientflows zulassen"** auf **Ja** ⚠️
7. Klicken Sie auf **"Speichern"**

## Schritt 4: API-Berechtigungen konfigurieren

1. Klicken Sie auf **"API-Berechtigungen"**
2. Klicken Sie auf **"Berechtigung hinzufügen"**
3. Wählen Sie **"Microsoft Graph"** → **"Delegierte Berechtigungen"**
4. Fügen Sie hinzu:
   - ✅ `Files.ReadWrite`
   - ✅ `User.Read`
   - ✅ `offline_access`
5. Klicken Sie auf **"Berechtigungen hinzufügen"**

## Schritt 5: Credentials-Datei erstellen

**Für lokale Entwicklung**: Bearbeiten Sie `src/main/services/onedrive-credentials.json`:

```json
{
  "client_id": "IHRE_ANWENDUNGS_CLIENT_ID"
}
```

**Für CI/CD-Builds**: Verwenden Sie GitHub Secrets (siehe unten)

## Schritt 6: In Marix konfigurieren

### Option A: Lokale Entwicklung

1. Erstellen Sie die `onedrive-credentials.json` Datei im Ordner `src/main/services/`
2. **WICHTIG**: Zu `.gitignore` hinzufügen:
```
src/main/services/onedrive-credentials.json
```

### Option B: CI/CD mit GitHub Secrets (Empfohlen)

1. Gehen Sie zu Ihrem GitHub-Repository → **Settings** → **Secrets and variables** → **Actions**
2. Fügen Sie dieses Secret hinzu:
   - `ONEDRIVE_CLIENT_ID`: Ihre OAuth Application (Client) ID
3. Der Build-Workflow injiziert automatisch die Anmeldedaten beim Build

## Schritt 7: Erstellen und Testen

```bash
npm run build
npm start
```

## Sicherheitshinweise

- ✅ **PKCE**: Kein Client-Secret erforderlich
- ✅ **RFC 8252**: Loopback-Umleitung mit zufälligen Ports
- ✅ **E2E-Verschlüsselung**: Argon2id + AES-256-GCM
- 📁 **Speicherort**: `/Marix/backup.marix`
- Verwenden Sie **GitHub Secrets** für CI/CD-Builds zum Schutz der Anmeldedaten
