"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.RDPManager = void 0;
const events_1 = require("events");
const child_process_1 = require("child_process");
const os = __importStar(require("os"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class RDPManager {
    constructor() {
        this.connections = new Map();
        this.isWindows = os.platform() === 'win32';
        this.isMacOS = os.platform() === 'darwin';
        this.isLinux = os.platform() === 'linux';
    }
    /**
     * Check if RDP dependencies are installed (Linux only)
     */
    checkDependencies() {
        if (!this.isLinux) {
            return { xfreerdp3: true, xdotool: true, distro: 'unknown' };
        }
        let xfreerdp3 = false;
        let xdotool = false;
        let distro = 'unknown';
        // Check xfreerdp3
        try {
            (0, child_process_1.execSync)('which xfreerdp3', { stdio: 'pipe' });
            xfreerdp3 = true;
        }
        catch {
            // Also check for xfreerdp (older name)
            try {
                (0, child_process_1.execSync)('which xfreerdp', { stdio: 'pipe' });
                xfreerdp3 = true;
            }
            catch {
                xfreerdp3 = false;
            }
        }
        // Check xdotool
        try {
            (0, child_process_1.execSync)('which xdotool', { stdio: 'pipe' });
            xdotool = true;
        }
        catch {
            xdotool = false;
        }
        // Detect Linux distribution
        try {
            if (fs.existsSync('/etc/os-release')) {
                const osRelease = fs.readFileSync('/etc/os-release', 'utf8');
                if (osRelease.includes('ID=debian') || osRelease.includes('ID=ubuntu') || osRelease.includes('ID_LIKE=debian')) {
                    distro = 'debian';
                }
                else if (osRelease.includes('ID=fedora') || osRelease.includes('ID=rhel') || osRelease.includes('ID_LIKE=fedora')) {
                    distro = 'fedora';
                }
                else if (osRelease.includes('ID=arch') || osRelease.includes('ID_LIKE=arch')) {
                    distro = 'arch';
                }
            }
        }
        catch {
            distro = 'unknown';
        }
        console.log(`[RDPManager] Dependencies check: xfreerdp3=${xfreerdp3}, xdotool=${xdotool}, distro=${distro}`);
        return { xfreerdp3, xdotool, distro };
    }
    /**
     * Get installation commands for missing dependencies
     * Returns the command string (without sudo prefix)
     */
    getInstallCommand(deps) {
        if (deps.xfreerdp3 && deps.xdotool) {
            return null;
        }
        const packages = [];
        if (!deps.xfreerdp3) {
            switch (deps.distro) {
                case 'debian':
                    packages.push('freerdp3-x11');
                    break;
                case 'fedora':
                    packages.push('freerdp');
                    break;
                case 'arch':
                    packages.push('freerdp');
                    break;
                default:
                    packages.push('freerdp3-x11'); // Default to Debian package name
            }
        }
        if (!deps.xdotool) {
            packages.push('xdotool');
        }
        if (packages.length === 0)
            return null;
        switch (deps.distro) {
            case 'debian':
                return `apt update && apt install -y ${packages.join(' ')}`;
            case 'fedora':
                return `dnf install -y ${packages.join(' ')}`;
            case 'arch':
                return `pacman -S --noconfirm ${packages.join(' ')}`;
            default:
                return `apt update && apt install -y ${packages.join(' ')}`;
        }
    }
    /**
     * Install missing dependencies with streaming output
     * Uses sudo -S to read password from stdin
     * Uses script command for PTY to get unbuffered output
     */
    installDependencies(deps, password, onData, onComplete) {
        const cmd = this.getInstallCommand(deps);
        if (!cmd) {
            onData('✓ All dependencies are already installed\n');
            onComplete(true);
            return;
        }
        onData(`\x1b[36m$ sudo ${cmd}\x1b[0m\n`);
        onData(`\x1b[33mAuthenticating...\x1b[0m\n`);
        // Use script to create a PTY for unbuffered output
        // This ensures apt/dnf output is streamed in real-time
        const wrappedCmd = `script -qec "${cmd.replace(/"/g, '\\"')}" /dev/null`;
        const sudoProcess = (0, child_process_1.spawn)('sudo', ['-S', 'bash', '-c', wrappedCmd], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env, DEBIAN_FRONTEND: 'noninteractive' },
        });
        let authFailed = false;
        let hasOutput = false;
        // Send password to stdin
        sudoProcess.stdin?.write(password + '\n');
        sudoProcess.stdin?.end();
        sudoProcess.stdout?.on('data', (data) => {
            const output = data.toString();
            hasOutput = true;
            // Clean up script command artifacts
            const cleanOutput = output
                .replace(/Script started.*\n?/g, '')
                .replace(/Script done.*\n?/g, '');
            if (cleanOutput.trim()) {
                onData(cleanOutput);
            }
        });
        sudoProcess.stderr?.on('data', (data) => {
            const output = data.toString();
            // Check for sudo password prompt or auth failure
            if (output.includes('sorry') || output.includes('Sorry') || output.includes('incorrect password')) {
                authFailed = true;
                onData(`\x1b[31m✗ Incorrect password\x1b[0m\n`);
            }
            else if (!output.includes('[sudo]') && !output.includes('password for')) {
                // Filter out password prompts, show other stderr
                hasOutput = true;
                onData(output);
            }
        });
        sudoProcess.on('close', (code) => {
            if (authFailed) {
                onComplete(false, 'Incorrect password');
                return;
            }
            if (code === 0) {
                onData(`\n\x1b[32m✓ Dependencies installed successfully!\x1b[0m\n`);
                onData(`\x1b[32mPlease close this dialog and try connecting again.\x1b[0m\n`);
                onComplete(true);
            }
            else {
                onData(`\n\x1b[31m✗ Installation failed (exit code: ${code})\x1b[0m\n`);
                onComplete(false, `Exit code: ${code}`);
            }
        });
        sudoProcess.on('error', (err) => {
            onData(`\x1b[31m✗ Error: ${err.message}\x1b[0m\n`);
            onComplete(false, err.message);
        });
    }
    /**
     * Run a command with streaming output (for non-pkexec commands)
     */
    runCommandWithStream(cmd, onData) {
        return new Promise((resolve) => {
            const process = (0, child_process_1.spawn)('bash', ['-c', cmd], {
                stdio: ['inherit', 'pipe', 'pipe'],
            });
            process.stdout?.on('data', (data) => {
                onData(data.toString());
            });
            process.stderr?.on('data', (data) => {
                onData(data.toString());
            });
            process.on('close', (code) => {
                resolve(code === 0);
            });
            process.on('error', (err) => {
                onData(`Error: ${err.message}\n`);
                resolve(false);
            });
        });
    }
    /**
     * Create RDP connection to Windows server
     * Uses Microsoft Remote Desktop on macOS, xfreerdp3 on Linux, mstsc on Windows
     */
    connect(connectionId, config) {
        const emitter = new events_1.EventEmitter();
        try {
            console.log(`[RDPManager] Connecting to ${config.host}:${config.port} (platform: ${os.platform()})`);
            if (this.isWindows) {
                return this.connectMstsc(connectionId, config, emitter);
            }
            else if (this.isMacOS) {
                return this.connectMacOS(connectionId, config, emitter);
            }
            else {
                return this.connectXfreerdp(connectionId, config, emitter);
            }
        }
        catch (err) {
            console.error('[RDPManager] Connection error:', err);
            return {
                emitter,
                success: false,
                error: err.message || 'Failed to connect',
            };
        }
    }
    /**
     * Connect using mstsc (Windows)
     */
    connectMstsc(connectionId, config, emitter) {
        const width = config.screen?.width || 1280;
        const height = config.screen?.height || 720;
        // Create .rdp file for mstsc
        const rdpContent = [
            `full address:s:${config.host}:${config.port}`,
            `username:s:${config.domain ? `${config.domain}\\${config.username}` : config.username}`,
            `screen mode id:i:${config.fullscreen ? 2 : 1}`,
            `desktopwidth:i:${width}`,
            `desktopheight:i:${height}`,
            `session bpp:i:32`,
            `compression:i:1`,
            `keyboardhook:i:2`,
            `audiocapturemode:i:0`,
            `videoplaybackmode:i:1`,
            `connection type:i:7`,
            `networkautodetect:i:1`,
            `bandwidthautodetect:i:1`,
            `displayconnectionbar:i:1`,
            `enableworkspacereconnect:i:0`,
            `disable wallpaper:i:0`,
            `allow font smoothing:i:1`,
            `allow desktop composition:i:1`,
            `disable full window drag:i:0`,
            `disable menu anims:i:0`,
            `disable themes:i:0`,
            `disable cursor setting:i:0`,
            `bitmapcachepersistenable:i:1`,
            `redirectclipboard:i:1`,
            `redirectprinters:i:0`,
            `redirectcomports:i:0`,
            `redirectsmartcards:i:0`,
            `redirectdrives:i:0`,
            `autoreconnection enabled:i:1`,
            `authentication level:i:0`,
            `prompt for credentials:i:0`,
            `negotiate security layer:i:1`,
            `remoteapplicationmode:i:0`,
            `gatewayusagemethod:i:4`,
            `gatewaycredentialssource:i:4`,
            `gatewayprofileusagemethod:i:0`,
            `promptcredentialonce:i:0`,
            `use redirection server name:i:0`,
        ].join('\r\n');
        // Save .rdp file to temp directory
        const tempDir = os.tmpdir();
        const rdpFilePath = path.join(tempDir, `marix_rdp_${connectionId}.rdp`);
        fs.writeFileSync(rdpFilePath, rdpContent);
        console.log(`[RDPManager] Created RDP file: ${rdpFilePath}`);
        // Store credentials using cmdkey for seamless login
        const credTarget = `TERMSRV/${config.host}`;
        const credUser = config.domain ? `${config.domain}\\${config.username}` : config.username;
        (0, child_process_1.exec)(`cmdkey /generic:"${credTarget}" /user:"${credUser}" /pass:"${config.password}"`, (err) => {
            if (err) {
                console.log('[RDPManager] cmdkey warning:', err.message);
            }
        });
        // Launch mstsc
        const rdpProcess = (0, child_process_1.spawn)('mstsc', [rdpFilePath], {
            detached: true,
            stdio: 'ignore',
            shell: true,
        });
        rdpProcess.unref();
        rdpProcess.on('error', (err) => {
            console.error(`[RDPManager] mstsc error:`, err);
            emitter.emit('error', err);
        });
        // Store connection
        this.connections.set(connectionId, {
            process: rdpProcess,
            connected: true,
            emitter,
            config,
            rdpFilePath,
        });
        setTimeout(() => {
            emitter.emit('connect');
        }, 1000);
        return { emitter, success: true };
    }
    /**
     * Connect using Microsoft Remote Desktop (macOS)
     */
    connectMacOS(connectionId, config, emitter) {
        const width = config.screen?.width || 1280;
        const height = config.screen?.height || 720;
        // Create .rdp file for Microsoft Remote Desktop on macOS
        const rdpContent = [
            `full address:s:${config.host}:${config.port}`,
            `username:s:${config.domain ? `${config.domain}\\${config.username}` : config.username}`,
            `screen mode id:i:${config.fullscreen ? 2 : 1}`,
            `desktopwidth:i:${width}`,
            `desktopheight:i:${height}`,
            `session bpp:i:32`,
            `compression:i:1`,
            `keyboardhook:i:2`,
            `audiocapturemode:i:0`,
            `videoplaybackmode:i:1`,
            `connection type:i:7`,
            `networkautodetect:i:1`,
            `bandwidthautodetect:i:1`,
            `displayconnectionbar:i:1`,
            `disable wallpaper:i:0`,
            `allow font smoothing:i:1`,
            `allow desktop composition:i:1`,
            `disable full window drag:i:0`,
            `disable menu anims:i:0`,
            `disable themes:i:0`,
            `redirectclipboard:i:1`,
            `redirectprinters:i:0`,
            `redirectdrives:i:0`,
            `autoreconnection enabled:i:1`,
            `authentication level:i:0`,
            `prompt for credentials:i:1`, // macOS app handles credentials via its own UI
            `negotiate security layer:i:1`,
        ].join('\r\n');
        // Save .rdp file to temp directory
        const tempDir = os.tmpdir();
        const rdpFilePath = path.join(tempDir, `marix_rdp_${connectionId}.rdp`);
        fs.writeFileSync(rdpFilePath, rdpContent);
        console.log(`[RDPManager] Created RDP file for macOS: ${rdpFilePath}`);
        // Try to open with Microsoft Remote Desktop app
        // The app can be installed from Mac App Store or via brew: brew install --cask microsoft-remote-desktop
        const rdpProcess = (0, child_process_1.spawn)('open', ['-a', 'Microsoft Remote Desktop', rdpFilePath], {
            detached: true,
            stdio: 'ignore',
        });
        rdpProcess.unref();
        rdpProcess.on('error', (err) => {
            console.error(`[RDPManager] Microsoft Remote Desktop error:`, err);
            // Fallback: try opening .rdp file directly (will use default app)
            const fallbackProcess = (0, child_process_1.spawn)('open', [rdpFilePath], {
                detached: true,
                stdio: 'ignore',
            });
            fallbackProcess.unref();
            fallbackProcess.on('error', (fallbackErr) => {
                console.error(`[RDPManager] Fallback open error:`, fallbackErr);
                emitter.emit('error', new Error('Microsoft Remote Desktop is not installed. Please install it from the Mac App Store.'));
            });
        });
        // Store connection
        this.connections.set(connectionId, {
            process: rdpProcess,
            connected: true,
            emitter,
            config,
            rdpFilePath,
        });
        // Emit connect after a short delay (app opens externally)
        setTimeout(() => {
            emitter.emit('connect');
        }, 1500);
        return { emitter, success: true };
    }
    /**
     * Connect using xfreerdp3 (Linux)
     */
    connectXfreerdp(connectionId, config, emitter) {
        const width = config.screen?.width || 1280;
        const height = config.screen?.height || 720;
        const args = [
            `/v:${config.host}:${config.port}`,
            `/u:${config.username}`,
            `/p:${config.password}`,
            `/t:RDP - ${config.host}`,
            '/cert:ignore',
            '/sec:nla',
            '+clipboard',
            '/dynamic-resolution',
            '/network:auto',
            '/gfx',
            '/bpp:32',
            '+auto-reconnect',
        ];
        if (config.fullscreen) {
            args.push('/f');
        }
        else {
            args.push(`/size:${width}x${height}`);
        }
        if (config.domain) {
            args.push(`/d:${config.domain}`);
        }
        console.log(`[RDPManager] Running: xfreerdp3 ${args.join(' ').replace(config.password, '****')}`);
        const rdpProcess = (0, child_process_1.spawn)('xfreerdp3', args, {
            detached: true,
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        let connected = false;
        let hasError = false;
        let errorMessage = '';
        const ERROR_DETECTION_TIMEOUT = 5000; // Wait 5s for errors before assuming success
        const CONNECTION_TIMEOUT = 20000; // 20 seconds max timeout
        // Error detection timeout - if no error after 5s, assume connected
        const errorDetectionId = setTimeout(() => {
            if (!connected && !hasError) {
                connected = true;
                clearTimeout(connectionTimeoutId);
                const conn = this.connections.get(connectionId);
                if (conn)
                    conn.connected = true;
                console.log(`[RDPManager] No errors detected after 5s, assuming connected`);
                emitter.emit('connect');
            }
        }, ERROR_DETECTION_TIMEOUT);
        // Max connection timeout
        const connectionTimeoutId = setTimeout(() => {
            if (!connected && !hasError) {
                hasError = true;
                clearTimeout(errorDetectionId);
                errorMessage = 'Connection timeout (20s). Server may be unreachable.';
                console.log(`[RDPManager] Connection timeout for ${connectionId}`);
                emitter.emit('error', new Error(errorMessage));
            }
        }, CONNECTION_TIMEOUT);
        rdpProcess.stdout?.on('data', (data) => {
            const output = data.toString();
            console.log(`[RDPManager] stdout: ${output}`);
            // Detect successful connection - GDI initialization means we're connected
            if (!connected && !hasError && (output.includes('gdi_init_ex') ||
                output.includes('Local framebuffer format') ||
                output.includes('Remote framebuffer format'))) {
                connected = true;
                clearTimeout(errorDetectionId);
                clearTimeout(connectionTimeoutId);
                const conn = this.connections.get(connectionId);
                if (conn)
                    conn.connected = true;
                console.log(`[RDPManager] Connection confirmed via GDI init`);
                emitter.emit('connect');
            }
        });
        rdpProcess.stderr?.on('data', (data) => {
            const output = data.toString();
            console.log(`[RDPManager] stderr: ${output}`);
            // Detect authentication errors - these are critical, check immediately
            if (!hasError && (output.includes('ERRCONNECT_LOGON_FAILURE') ||
                output.includes('ERRCONNECT_WRONG_PASSWORD') ||
                output.includes('ERRCONNECT_AUTHENTICATION_FAILED') ||
                output.includes('ERRCONNECT_ACCESS_DENIED') ||
                output.includes('NLA_AUTH_FAILED') ||
                output.includes('Authentication failure') ||
                output.includes('LOGON_FAILURE') ||
                output.includes('0x00000014') || // ERRCONNECT_LOGON_FAILURE hex
                output.includes('0x00000015') // ERRCONNECT_WRONG_PASSWORD hex
            )) {
                hasError = true;
                clearTimeout(errorDetectionId);
                clearTimeout(connectionTimeoutId);
                errorMessage = 'Authentication failed. Check username/password.';
                console.log(`[RDPManager] Auth error detected`);
                emitter.emit('error', new Error(errorMessage));
                return;
            }
            // Detect account issues
            if (!hasError && (output.includes('ERRCONNECT_ACCOUNT_DISABLED') ||
                output.includes('ERRCONNECT_ACCOUNT_LOCKED_OUT') ||
                output.includes('ERRCONNECT_ACCOUNT_EXPIRED') ||
                output.includes('ERRCONNECT_ACCOUNT_RESTRICTION'))) {
                hasError = true;
                clearTimeout(errorDetectionId);
                clearTimeout(connectionTimeoutId);
                errorMessage = 'Account issue. Account may be disabled, locked or expired.';
                console.log(`[RDPManager] Account error detected`);
                emitter.emit('error', new Error(errorMessage));
                return;
            }
            // Detect connection errors
            if (!hasError && (output.includes('ERRCONNECT_CONNECT_FAILED') ||
                output.includes('ERRCONNECT_CONNECT_TRANSPORT_FAILED') ||
                output.includes('TRANSPORT_CONNECT_FAILED') ||
                output.includes('ERRCONNECT_TLS_CONNECT_FAILED') ||
                output.includes('ERRCONNECT_SECURITY_NEGO_CONNECT_FAILED') ||
                output.includes('Connection refused') ||
                output.includes('Network is unreachable') ||
                output.includes('No route to host') ||
                output.includes('unable to connect') ||
                output.includes('0x00000006') // ERRCONNECT_CONNECT_FAILED hex
            )) {
                hasError = true;
                clearTimeout(errorDetectionId);
                clearTimeout(connectionTimeoutId);
                errorMessage = 'Connection failed. Check if server is reachable and RDP is enabled.';
                console.log(`[RDPManager] Connection error detected`);
                emitter.emit('error', new Error(errorMessage));
                return;
            }
            // Detect DNS errors
            if (!hasError && (output.includes('ERRCONNECT_DNS_ERROR') ||
                output.includes('ERRCONNECT_DNS_NAME_NOT_FOUND') ||
                output.includes('getaddrinfo') ||
                output.includes('Name or service not known'))) {
                hasError = true;
                clearTimeout(errorDetectionId);
                clearTimeout(connectionTimeoutId);
                errorMessage = 'Cannot resolve hostname. Check server address.';
                console.log(`[RDPManager] DNS error detected`);
                emitter.emit('error', new Error(errorMessage));
                return;
            }
            // Detect license errors
            if (!hasError && (output.includes('ERRINFO_LICENSE_') ||
                output.includes('LICENSE_'))) {
                hasError = true;
                clearTimeout(errorDetectionId);
                clearTimeout(connectionTimeoutId);
                errorMessage = 'License error. Server may have licensing issues.';
                console.log(`[RDPManager] License error detected`);
                emitter.emit('error', new Error(errorMessage));
                return;
            }
        });
        rdpProcess.on('close', (code) => {
            console.log(`[RDPManager] xfreerdp3 exited with code ${code}`);
            clearTimeout(errorDetectionId);
            clearTimeout(connectionTimeoutId);
            this.connections.delete(connectionId);
            // If process exited before we detected connection and no error was emitted
            if (!connected && !hasError && code !== 0) {
                errorMessage = `Connection failed (exit code: ${code})`;
                emitter.emit('error', new Error(errorMessage));
            }
            emitter.emit('close');
        });
        rdpProcess.on('error', (err) => {
            console.error(`[RDPManager] Process error:`, err);
            clearTimeout(errorDetectionId);
            clearTimeout(connectionTimeoutId);
            if (!hasError) {
                hasError = true;
                emitter.emit('error', err);
            }
        });
        this.connections.set(connectionId, {
            process: rdpProcess,
            connected: false,
            emitter,
            config,
        });
        return { emitter, success: true };
    }
    /**
     * Disconnect RDP session
     */
    disconnect(connectionId) {
        const conn = this.connections.get(connectionId);
        if (conn) {
            try {
                if (!conn.process.killed) {
                    conn.process.kill('SIGTERM');
                }
                if (this.isWindows) {
                    const credTarget = `TERMSRV/${conn.config.host}`;
                    (0, child_process_1.exec)(`cmdkey /delete:"${credTarget}"`, () => { });
                    if (conn.rdpFilePath && fs.existsSync(conn.rdpFilePath)) {
                        fs.unlinkSync(conn.rdpFilePath);
                    }
                }
            }
            catch (err) {
                console.error(`[RDPManager] Error killing process ${connectionId}:`, err);
            }
            this.connections.delete(connectionId);
            console.log(`[RDPManager] Disconnected: ${connectionId}`);
        }
    }
    /**
     * Check if connection exists and is active
     */
    isConnected(connectionId) {
        const conn = this.connections.get(connectionId);
        return conn?.connected ?? false;
    }
    /**
     * Get the number of active connections
     */
    getActiveCount() {
        return this.connections.size;
    }
    /**
     * Close all connections - called when app is closing
     */
    closeAll() {
        // Use try-catch for all console operations to prevent EPIPE errors when app is closing
        const safeLog = (msg) => {
            try {
                console.log(msg);
            }
            catch { /* ignore EPIPE */ }
        };
        const safeError = (msg, err) => {
            try {
                console.error(msg, err);
            }
            catch { /* ignore EPIPE */ }
        };
        safeLog(`[RDPManager] Closing all ${this.connections.size} RDP connections...`);
        for (const [id, conn] of this.connections) {
            try {
                if (!conn.process.killed) {
                    conn.process.kill('SIGTERM');
                }
                if (this.isWindows) {
                    const credTarget = `TERMSRV/${conn.config.host}`;
                    (0, child_process_1.exec)(`cmdkey /delete:"${credTarget}"`, () => { });
                    if (conn.rdpFilePath && fs.existsSync(conn.rdpFilePath)) {
                        fs.unlinkSync(conn.rdpFilePath);
                    }
                }
            }
            catch (err) {
                safeError(`[RDPManager] Error closing ${id}:`, err);
            }
        }
        this.connections.clear();
        safeLog('[RDPManager] All connections closed');
    }
    /**
     * Focus the RDP window using xdotool (Linux only)
     */
    focusWindow(connectionId) {
        if (this.isWindows)
            return;
        const conn = this.connections.get(connectionId);
        if (conn) {
            const title = `RDP - ${conn.config.host}`;
            const xdotool = (0, child_process_1.spawn)('xdotool', ['search', '--name', title, 'windowactivate']);
            xdotool.on('error', (err) => {
                console.error('[RDPManager] xdotool error:', err);
            });
        }
    }
    /**
     * Toggle fullscreen for RDP window (Linux only)
     */
    toggleFullscreen(connectionId) {
        if (this.isWindows)
            return;
        const conn = this.connections.get(connectionId);
        if (conn) {
            const title = `RDP - ${conn.config.host}`;
            const findWindow = (0, child_process_1.spawn)('xdotool', ['search', '--name', title]);
            let windowId = '';
            findWindow.stdout.on('data', (data) => {
                windowId = data.toString().trim().split('\n')[0];
            });
            findWindow.on('close', () => {
                if (windowId) {
                    (0, child_process_1.spawn)('xdotool', ['windowactivate', '--sync', windowId], {
                        stdio: 'ignore'
                    }).on('close', () => {
                        (0, child_process_1.spawn)('xdotool', ['key', '--window', windowId, 'ctrl+alt+Return'], {
                            stdio: 'ignore'
                        });
                    });
                }
            });
            findWindow.on('error', (err) => {
                console.error('[RDPManager] xdotool error:', err);
            });
        }
    }
    // These methods are no longer needed with xfreerdp (it handles input natively)
    sendMouse(connectionId, x, y, button, isPressed) { }
    sendWheel(connectionId, x, y, step, isNegative, isHorizontal) { }
    sendScancode(connectionId, code, isPressed) { }
    sendUnicode(connectionId, code, isPressed) { }
}
exports.RDPManager = RDPManager;
//# sourceMappingURL=RDPManager.js.map