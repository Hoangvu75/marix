# Build & Release Workflow

> Marix SSH Client - Transparent Build Process

This document explains how Marix releases are built and how you can verify the authenticity of downloaded binaries.

---

## 🔐 Build Verification

Every Marix release includes build metadata embedded in the binary, allowing users to verify:

1. **Commit SHA** - The exact source code used to build the binary
2. **Build Time** - When the binary was built
3. **GitHub Actions Run ID** - Direct link to the build logs

### Verifying a Release

1. **In the App:**
   - Open Marix
   - Go to **Settings** → **About**
   - Check the **Build Info** section

2. **On GitHub:**
   - Each release shows the commit SHA
   - Click the **Build Run** link to see full build logs
   - Compare the SHA in the app with the release page

3. **Manual Verification:**
   ```bash
   # Clone the repository at the specific commit
   git clone https://github.com/marixdev/marix.git
   cd marix
   git checkout <commit-sha>
   
   # Install and build
   npm ci
   npm run build
   npm run package
   
   # Compare with the downloaded binary
   ```

---

## 📦 Build Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                    GitHub Actions Workflow                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐                                            │
│  │  Push to main   │                                            │
│  │  or manual run  │                                            │
│  └────────┬────────┘                                            │
│           │                                                     │
│           ▼                                                     │
│  ┌─────────────────┐                                            │
│  │ Inject Build    │  ← Embeds commit SHA, timestamp            │
│  │ Information     │                                            │
│  └────────┬────────┘                                            │
│           │                                                     │
│           ▼                                                     │
│  ┌─────────────────────────────────────────────┐                │
│  │              Parallel Builds                 │                │
│  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌────┐ │                │
│  │  │ Linux  │  │Windows │  │Win Leg │  │macOS│ │                │
│  │  │ x64    │  │ x64    │  │ x64    │  │ ARM │ │                │
│  │  └────────┘  └────────┘  └────────┘  └────┘ │                │
│  └────────────────────┬────────────────────────┘                │
│                       │                                         │
│                       ▼                                         │
│  ┌─────────────────────────────────────────────┐                │
│  │         Upload Artifacts                     │                │
│  │  AppImage, DEB, RPM, EXE, ZIP               │                │
│  └────────────────────┬────────────────────────┘                │
│                       │                                         │
│                       ▼                                         │
│  ┌─────────────────────────────────────────────┐                │
│  │         Create GitHub Release                │                │
│  │  • Auto-tag with version                    │                │
│  │  • Include build verification info          │                │
│  │  • Attach all platform binaries             │                │
│  └─────────────────────────────────────────────┘                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🏗️ Build Environments

| Platform | Runner | Electron | Node.js |
|----------|--------|----------|---------|
| **Linux** | ubuntu-latest | 39.x | 22.x |
| **Windows** | windows-latest | 39.x | 22.x |
| **Windows Legacy** | windows-latest | 22.3.27 | 22.x |
| **macOS** | macos-latest | 39.x | 22.x |



## 📋 Build Steps Detail

### 1. Inject Build Info

```bash
npm run inject-build-info
```

This script (`scripts/inject-build-info.js`) creates `src/build-info.json`:

```json
{
  "commitSha": "abc123...",
  "commitShort": "abc123",
  "branch": "main",
  "buildTime": "2026-01-21T10:00:00Z",
  "buildTimestamp": 1768988400000,
  "runId": "12345678",
  "repository": "marixdev/marix",
  "nodeVersion": "v22.x.x",
  "platform": "linux",
  "arch": "x64"
}
```

### 2. Build TypeScript

```bash
npm run build:main      # Main process
npm run build:renderer  # React UI
```

### 3. Package with electron-builder

```bash
npm run package:linux  # AppImage, DEB, RPM
npm run package:win    # NSIS installer
npm run package:mac    # ZIP archive
```

---

## 🔄 Triggers

The build workflow runs on:

1. **Push to `main` branch**
   - Automatically builds and releases

2. **Manual trigger (`workflow_dispatch`)**
   - Allows building from any branch
   - Optional version override

3. **Tag push (e.g., `1.0.10`)**
   - Creates release with that version

---

## 🛡️ Security Considerations

### What's Verified

✅ Commit SHA embedded in binary
✅ Full build logs publicly available
✅ Reproducible build environment (GitHub Actions)
✅ No secrets in build artifacts

### What's NOT Verified

❌ Code signing (not implemented yet)
❌ Binary checksums in release notes (manual)
❌ Reproducible builds (dependencies may vary)

### Future Improvements

- [ ] Add SHA256 checksums to release notes
- [ ] Code signing for Windows (requires certificate)
- [ ] Code signing for macOS (requires Apple Developer ID)
- [ ] Reproducible builds with locked dependencies

---

## 📝 Release Notes Template

Each release automatically includes:

```markdown
## Marix SSH Client X.X.X

### 🔐 Build Verification

| Property | Value |
|----------|-------|
| **Commit SHA** | `abc123...` |
| **Build Run** | [#12345678](link) |
| **Build Time** | 2026-01-21T10:00:00Z |

### Downloads
| Platform | File | Supported OS |
|----------|------|--------------|
| Linux | AppImage, DEB, RPM | Ubuntu 18.04+ |
| Windows | EXE installer | Windows 10/11 |
| Windows (Legacy) | EXE installer | Windows 7/8/Server 2012 |
| macOS | ZIP (Universal) | macOS 10.15+ |
```

---

## 🧰 Local Development Build

To build locally:

```bash
# Clone repository
git clone https://github.com/marixdev/marix.git
cd marix

# Install dependencies
npm install

# Inject build info (will use local git info)
npm run inject-build-info

# Build
npm run build

# Package for your platform
npm run package:linux  # or :win or :mac
```

---

## 📚 Related Documentation

- [SECURITY.md](SECURITY.md) - Security architecture
- [CHANGELOG.md](CHANGELOG.md) - Version history
- [README.md](README.md) - Getting started

---

*Last updated: January 2026*
