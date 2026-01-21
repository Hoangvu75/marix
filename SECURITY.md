# Security Overview

> **Marix SSH Client – Security Model & Threat Analysis**  
> Last updated: 2026-01

Marix is an open-source, cross-platform SSH client designed to help users manage multiple servers efficiently.  
This document explains **what Marix protects**, **how it protects it**, and **what it explicitly does not attempt to protect against**.

This is **not a formal security audit** and Marix should **not** be considered a hardened or formally verified security product.

---

## 1. Threat Model (Important)

Marix is designed to protect against:

- Accidental credential disclosure
- Local credential theft from casual malware
- Backup leakage (cloud storage, lost files)
- Offline brute-force attacks against encrypted backups
- MITM attacks via SSH host key verification

Marix **does NOT claim protection against**:

- A malicious or fully compromised SSH server
- Hostile or untrusted networks
- Kernel-level malware on the local machine
- Supply-chain attacks at the OS or runtime level
- Zero-day vulnerabilities in OpenSSH, Electron, Chromium, Node.js, or dependencies

If your threat model includes **nation-state adversaries, hostile servers, or untrusted execution environments**, you should use **OpenSSH CLI directly** and avoid GUI wrappers entirely.

---

## 2. Credential Storage (At Rest)

Sensitive data is stored using **Electron safeStorage**, which delegates encryption to the operating system:

| Platform | Backend |
|--------|--------|
| macOS | Apple Keychain |
| Windows | DPAPI |
| Linux | libsecret (GNOME Keyring / KWallet) |

Security properties:

- Secrets are encrypted and bound to the OS user
- Data cannot be decrypted on another machine
- No custom password vault implementation

Marix **does not implement its own credential store**.

---

## 3. Backup Encryption

Backups are encrypted using standard, well-studied primitives:

- **KDF:** Argon2id  
- **Encryption:** AES-256-GCM (AEAD)  
- **Randomness:** Secure system RNG  

### Argon2id Calibration

- Local calibration targets ~1 second runtime
- Parameters are stored inside the backup file
- Ensures cross-machine decrypt compatibility
- Enforces a minimum security floor (memory + iterations)

This design prioritizes **offline brute-force resistance** over speed.

---

## 4. SSH & Terminal Handling

### SSH Protocol

- SSH protocol handled by:
  - System OpenSSH (interactive terminals via PTY)
  - `ssh2` library (non-interactive and SFTP use cases)

Marix **does not re-implement SSH cryptography**.

### Terminal Parsing

Marix renders server-controlled output in a terminal emulator.

⚠️ **Important**  
Any terminal emulator that parses remote output may be vulnerable to control-sequence or logic attacks.

This risk exists in **xterm, tmux, screen, iTerm, and GUI SSH clients alike**.  
Marix does not claim immunity to malicious terminal output.

---

## 5. Host Key Verification

- SSH host keys are verified using:
  - `ssh-keyscan`
  - SHA-256 fingerprints
- First connection requires explicit user confirmation
- Host key changes trigger warnings and require user action

---

## 6. SSH Key Handling

- Private keys are stored encrypted at rest
- When required by OpenSSH:
  - Keys are written to temporary files
  - File permissions set to `0600`
  - Files are removed immediately after use
- No persistent plaintext key storage

---

## 7. Cloud & OAuth Integrations

- Uses official OAuth flows (PKCE / Device Flow)
- Tokens stored encrypted via OS keychain
- Local callback servers bind to `localhost` only
- No credentials are transmitted to third-party servers

---

## 8. Electron Security Considerations

Marix is an **Electron application**, which implies:

- Chromium runtime
- Node.js execution environment
- Larger attack surface compared to CLI-only tools

Marix **does not claim Electron is secure by default**.

Hardening measures include:

- Reduced IPC surface
- No remote code execution in renderer
- No remote script loading

---

## 9. Supply-Chain & Build Transparency

### Current State

- Source code is fully open-source
- Releases are built via CI
- Dependencies are locked using lockfiles

### Roadmap

- CI-only release builds
- Public GitHub Actions workflows
- Commit-linked release artifacts
- Published checksums

These measures are intended to mitigate **supply-chain risks**.

---

## 10. What Marix Is — And Is Not

**Marix is:**

- A productivity-focused SSH frontend
- Designed for managing multiple hosts
- Transparent about its design choices

**Marix is NOT:**

- A hardened security appliance
- A replacement for OpenSSH CLI in hostile environments
- A formally audited cryptographic product

---

## 11. Responsible Disclosure

If you discover a security issue:

1. Do **not** publish exploit details publicly
2. Report the issue privately with reproduction steps
3. Include environment and version information

---

## Final Note

Security is a **process**, not a checkbox.

Marix prioritizes:
- Clear threat boundaries
- Practical security trade-offs
- Transparency over marketing claims

If your security requirements exceed this scope, **Marix is not the right tool — and that is acceptable**.
