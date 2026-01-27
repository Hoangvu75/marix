# Command History (Command Recall)

Marix provides a **Command History** feature that stores and recalls previously executed commands for each server. This helps you quickly re-run common commands without typing them again.

## Features

- **Per-Server History**: Each server maintains its own command history
- **Local Storage Only**: Commands are stored locally, never synced or backed up
- **Sensitive Data Filtering**: Automatically filters out commands containing passwords, tokens, or secrets
- **LRU Pruning**: Automatically removes old commands (max 50 per server)
- **Execution Counter**: Tracks how many times each command has been used
- **Search**: Quickly filter commands with fuzzy search

## How to Enable

Command History is **disabled by default** for privacy. To enable:

1. Open **Settings** (gear icon in sidebar)
2. Navigate to **Terminal** section
3. Toggle **Enable Command Recall**

## Usage

### Opening Command History

When in a terminal session, press:
- **`Tab`** key when the terminal input is empty (cursor at empty line)
- Or click the **History** button in the terminal toolbar

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Tab` (empty input) | Open command recall popup |
| `↑` / `↓` | Navigate through commands |
| `Enter` | Execute selected command |
| `Escape` | Close popup |
| `Delete` / `Backspace` | Delete selected command |

### Popup Actions

- **Click** a command to execute it immediately
- **Search** by typing in the search box
- **Delete** individual commands with the trash icon
- **Save as Snippet** to convert a command to a reusable snippet

## Privacy & Security

### Filtered Commands

Commands matching these patterns are **never stored**:

- Commands containing `password`, `passwd`, `secret`, `token`
- Commands with `api_key` or `apikey`
- MySQL commands with `-p` flag (password)
- `sudo -S` (stdin password)
- Commands using `sshpass` or `expect` with password
- Environment variable exports with sensitive values

### Data Storage

- Stored in browser's `localStorage`
- **Never synced** to cloud services
- **Never included** in backups
- Cleared when you clear browser data

### Clearing History

To clear command history:

1. Open **Settings** → **Terminal**
2. Click **Clear Command History**

Or clear per-server from the command recall popup.

## Technical Details

### Storage Format

```typescript
interface RecalledCommand {
  id: string;         // Unique identifier
  serverId: string;   // Associated server
  command: string;    // The command text
  createdAt: number;  // First execution timestamp
  lastUsedAt: number; // Last execution timestamp
  execCount: number;  // Execution count
}
```

### Limits

| Limit | Value |
|-------|-------|
| Max commands per server | 50 |
| Min command length | 2 characters |
| Storage | localStorage |

### Files

- Store: `src/renderer/services/commandRecallStore.ts`
- Popup UI: `src/renderer/components/CommandRecallPopup.tsx`
- Panel UI: `src/renderer/components/CommandRecallPanel.tsx`

## FAQ

### Why are some commands not saved?

Commands containing sensitive patterns (passwords, tokens, etc.) are automatically filtered for security.

### Can I export my command history?

No, command history is intentionally local-only and not exportable for privacy reasons.

### Does command history sync between devices?

No, command history is stored locally and never synced.

### How do I disable command history?

Go to Settings → Terminal → Disable "Enable Command Recall". Existing history is preserved until you clear it manually.
