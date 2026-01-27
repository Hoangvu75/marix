# Server Notes (Sticky Notes)

Marix provides a **Server Notes** feature that allows you to attach personal notes to each server. This is useful for documenting server configurations, maintenance reminders, or quick reference information.

## Features

- **Per-Server Notes**: Each server can have its own notes
- **Auto-Save**: Changes are automatically saved as you type (500ms debounce)
- **Rich Text Support**: Plain text with line breaks
- **Visual Indicator**: Servers with notes show a filled note icon
- **Synced with Server Data**: Notes are included in server backups

## Usage

### Opening Notes

1. Connect to a server (SSH terminal or SFTP)
2. Click the **Notes** button in the top toolbar (pencil icon)
3. A sticky note popup appears in the bottom-right corner

### Writing Notes

- Simply type in the textarea
- Notes are **auto-saved** after 500ms of inactivity
- The "Saving..." indicator shows when a save is in progress
- Press `Escape` or click outside to close

### Visual Indicators

| Icon State | Meaning |
|------------|---------|
| Outline (empty) | No notes for this server |
| Filled (solid) | Server has notes |
| Amber/Yellow color | Notes exist |

## Use Cases

### Server Configuration

```
Web Server - Production
-----------------------
IP: 192.168.1.100
Nginx: /etc/nginx/sites-enabled/
Logs: /var/log/nginx/
SSL Cert expires: 2026-12-15
```

### Maintenance Reminders

```
TODO:
- [ ] Update OpenSSL (CVE-2025-XXXX)
- [ ] Rotate database credentials
- [ ] Increase swap to 4GB
```

### Quick Reference

```
Common Commands:
- Restart Nginx: sudo systemctl restart nginx
- Check disk: df -h
- View connections: netstat -tuln

Database:
- User: app_user
- Port: 5432
```

### Contact Information

```
Server Owner: DevOps Team
Escalation: ops@company.com
Last maintenance: 2025-01-15
```

## Data Storage

### Where Notes Are Stored

Notes are stored as part of the server configuration in:
- **Electron Store**: `~/.config/marix/servers.json` (Linux)
- **Electron Store**: `%APPDATA%/marix/servers.json` (Windows)
- **Electron Store**: `~/Library/Application Support/marix/servers.json` (macOS)

### Backup & Sync

- ✅ **Included in local backups** (Marix backup feature)
- ✅ **Included in cloud backups** (Google Drive, Box)
- ✅ **Encrypted** when using backup encryption

### Server Data Structure

```typescript
interface Server {
  id: string;
  name: string;
  host: string;
  // ... other fields
  notes?: string;  // Server notes stored here
}
```

## UI Components

### Sticky Note Popup

The note popup appears in the bottom-right corner with:
- Header showing server name
- Auto-resize textarea
- "Saving..." indicator
- Close button (X)

### Styling

- **Dark theme**: Amber/brown color scheme
- **Light theme**: Light amber/yellow color scheme
- Matches sticky note aesthetic

## Technical Details

### Auto-Save Implementation

```typescript
// Debounced auto-save (500ms)
const noteDebounceRef = useRef<NodeJS.Timeout>();

onChange={(e) => {
  setNoteContent(e.target.value);
  
  clearTimeout(noteDebounceRef.current);
  noteDebounceRef.current = setTimeout(async () => {
    await ipcRenderer.invoke('servers:update', updatedServer);
  }, 500);
}}
```

### Files

- UI: `src/renderer/App.tsx` (NotePopup section)
- State: Server object `notes` field
- Storage: `src/main/serverStore.ts`

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Escape` | Close note popup |
| Click outside | Close note popup |

## FAQ

### Are notes encrypted?

Notes are stored as plain text in the server configuration file. When you create an encrypted backup, notes are encrypted along with all server data.

### Can I use Markdown?

Notes are currently plain text only. Markdown rendering may be added in a future version.

### Is there a character limit?

No hard limit, but very long notes may affect performance. Recommended to keep notes concise.

### Can I search across all notes?

Currently, notes are only visible per-server. A global search feature may be added in the future.

### Are notes synced automatically?

Notes sync when you use the Backup/Restore feature. There's no real-time sync between devices.
