# Google Drive Backup-Einrichtungsanleitung

> **Sprachen**: [🇺🇸 English](GOOGLE_DRIVE_SETUP.en.md) | [🇻🇳 Tiếng Việt](GOOGLE_DRIVE_SETUP.vi.md) | [🇮🇩 Bahasa Indonesia](GOOGLE_DRIVE_SETUP.id.md) | [🇨🇳 中文](GOOGLE_DRIVE_SETUP.zh.md) | [🇰🇷 한국어](GOOGLE_DRIVE_SETUP.ko.md) | [🇯🇵 日本語](GOOGLE_DRIVE_SETUP.ja.md) | [🇫🇷 Français](GOOGLE_DRIVE_SETUP.fr.md) | [🇩🇪 Deutsch](GOOGLE_DRIVE_SETUP.de.md) | [🇪🇸 Español](GOOGLE_DRIVE_SETUP.es.md) | [🇹🇭 ภาษาไทย](GOOGLE_DRIVE_SETUP.th.md) | [🇲🇾 Bahasa Melayu](GOOGLE_DRIVE_SETUP.ms.md) | [🇷🇺 Русский](GOOGLE_DRIVE_SETUP.ru.md) | [🇵🇭 Filipino](GOOGLE_DRIVE_SETUP.fil.md) | [🇧🇷 Português](GOOGLE_DRIVE_SETUP.pt.md)

---

## Schritt 1: Google Cloud-Projekt erstellen

1. Gehen Sie zu [Google Cloud Console](https://console.cloud.google.com/)
2. Klicken Sie auf **"Neues Projekt"** in der oberen rechten Ecke
3. Benennen Sie Ihr Projekt: `Marix SSH Client` oder einen Namen Ihrer Wahl
4. Klicken Sie auf **"Erstellen"**

## Schritt 2: Google Drive-API aktivieren

1. Gehen Sie in Ihrem neuen Projekt zu **"APIs & Dienste"** > **"Bibliothek"**
2. Suchen Sie nach **"Google Drive API"**
3. Klicken Sie auf das Ergebnis und drücken Sie **"Aktivieren"**

## Schritt 3: OAuth 2.0-Anmeldeinformationen erstellen

### 3.1. OAuth-Zustimmungsbildschirm konfigurieren

1. Gehen Sie zu **"APIs & Dienste"** > **"OAuth-Zustimmungsbildschirm"**
2. Wählen Sie **"Extern"** (erlaubt jedem Google-Kontonutzer)
3. Klicken Sie auf **"Erstellen"**

**App-Informationen:**
- App-Name: `Marix SSH Client`
- E-Mail für Nutzersupport: `your-email@gmail.com`
- App-Logo: (optional) laden Sie Ihr Logo hoch
- Startseite der Anwendung: `https://github.com/marixdev/marix`

**Kontaktinformationen des Entwicklers:**
- E-Mail-Adressen: `your-email@gmail.com`

4. Klicken Sie auf **"Speichern und fortfahren"**

**Bereiche:**
5. Klicken Sie auf **"Bereiche hinzufügen oder entfernen"**
6. Suchen und wählen Sie den folgenden Bereich:
   - `https://www.googleapis.com/auth/drive.file`
7. Klicken Sie auf **"Aktualisieren"** und **"Speichern und fortfahren"**

### 3.2. OAuth-Client-ID erstellen

1. Gehen Sie zu **"APIs & Dienste"** > **"Anmeldedaten"**
2. Klicken Sie auf **"Anmeldedaten erstellen"** > **"OAuth-Client-ID"**
3. Wählen Sie **"Desktopanwendung"**
4. Benennen Sie es: `Marix Desktop Client`
5. Klicken Sie auf **"Erstellen"**

6. **JSON-Datei herunterladen**: Klicken Sie auf das Download-Symbol
7. **Für lokale Entwicklung**: Erstellen Sie `google-credentials.json` in `src/main/services/`:
```json
{
  "installed": {
    "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
    "client_secret": "YOUR_CLIENT_SECRET"
  }
}
```

8. **Für CI/CD-Builds**: Verwenden Sie GitHub Secrets (siehe unten)

## Schritt 4: In Marix konfigurieren

### Option A: Lokale Entwicklung

1. Kopieren Sie die `google-credentials.json` Datei in den Ordner `src/main/services/`
2. **WICHTIG**: Zu `.gitignore` hinzufügen:
```
src/main/services/google-credentials.json
```

### Option B: CI/CD mit GitHub Secrets (Empfohlen)

1. Gehen Sie zu Ihrem GitHub-Repository → **Settings** → **Secrets and variables** → **Actions**
2. Fügen Sie diese Secrets hinzu:
   - `GOOGLE_CLIENT_ID`: Ihre OAuth-Client-ID
   - `GOOGLE_CLIENT_SECRET`: Ihr OAuth-Client-Secret
3. Der Build-Workflow injiziert automatisch die Anmeldedaten beim Build

## Schritt 5: OAuth-Ablauf testen

1. Öffnen Sie die Marix-App
2. Gehen Sie zu **Einstellungen** > **Sichern & Wiederherstellen**
3. Wählen Sie den Tab **"Google Drive"**
4. Klicken Sie auf **"Mit Google Drive verbinden"**
5. Der Browser öffnet sich mit dem Google OAuth-Bildschirm
6. Wählen Sie Ihr Google-Konto und erteilen Sie Berechtigungen
7. Die App erhält den Token und zeigt "Verbunden" an

## Sicherheitshinweise

- **NICHT** `google-credentials.json` in Git committen
- Verwenden Sie **GitHub Secrets** für CI/CD-Builds zum Schutz des client_secret
- Refresh-Tokens werden im Electron Store gespeichert (verschlüsselt)
- PKCE wird für zusätzliche OAuth-Sicherheit verwendet

## App veröffentlichen (Erforderlich)

1. Gehen Sie zum **OAuth-Zustimmungsbildschirm**
2. Klicken Sie auf **"App veröffentlichen"**
3. Ihre App wird sofort genehmigt
4. Jeder kann sie ohne "nicht verifizierte App"-Warnungen nutzen

## Fehlerbehebung

### Fehler: "Access blocked: This app's request is invalid"
- OAuth-Zustimmungsbildschirm vollständig konfiguriert prüfen

### Fehler: "The OAuth client was not found"
- Client-ID in der Anmeldedatei überprüfen
- JSON-Datei erneut von Google Cloud Console herunterladen

### Fehler: "Access denied"
- Benutzer hat die Berechtigung verweigert
