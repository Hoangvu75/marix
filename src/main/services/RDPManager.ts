import { EventEmitter } from 'events';
import { spawn, ChildProcess, exec } from 'child_process';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

interface RDPConnection {
  process: ChildProcess;
  connected: boolean;
  emitter: EventEmitter;
  config: {
    host: string;
    port: number;
    username: string;
    password: string;
    domain?: string;
    fullscreen?: boolean;
  };
  rdpFilePath?: string;
}

export class RDPManager {
  private connections: Map<string, RDPConnection> = new Map();
  private isWindows: boolean = os.platform() === 'win32';

  /**
   * Create RDP connection to Windows server
   * Uses xfreerdp3 on Linux, mstsc on Windows
   */
  connect(
    connectionId: string,
    config: {
      host: string;
      port: number;
      username: string;
      password: string;
      domain?: string;
      screen?: { width: number; height: number };
      fullscreen?: boolean;
    }
  ): { emitter: EventEmitter; success: boolean; error?: string } {
    const emitter = new EventEmitter();

    try {
      console.log(`[RDPManager] Connecting to ${config.host}:${config.port} (platform: ${os.platform()})`);

      if (this.isWindows) {
        return this.connectMstsc(connectionId, config, emitter);
      } else {
        return this.connectXfreerdp(connectionId, config, emitter);
      }
    } catch (err: any) {
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
  private connectMstsc(
    connectionId: string,
    config: {
      host: string;
      port: number;
      username: string;
      password: string;
      domain?: string;
      screen?: { width: number; height: number };
      fullscreen?: boolean;
    },
    emitter: EventEmitter
  ): { emitter: EventEmitter; success: boolean; error?: string } {
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
    
    exec(`cmdkey /generic:"${credTarget}" /user:"${credUser}" /pass:"${config.password}"`, (err) => {
      if (err) {
        console.log('[RDPManager] cmdkey warning:', err.message);
      }
    });

    // Launch mstsc
    const rdpProcess = spawn('mstsc', [rdpFilePath], {
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
   * Connect using xfreerdp3 (Linux)
   */
  private connectXfreerdp(
    connectionId: string,
    config: {
      host: string;
      port: number;
      username: string;
      password: string;
      domain?: string;
      screen?: { width: number; height: number };
      fullscreen?: boolean;
    },
    emitter: EventEmitter
  ): { emitter: EventEmitter; success: boolean; error?: string } {
    const width = config.screen?.width || 1280;
    const height = config.screen?.height || 720;

    const args: string[] = [
      `/v:${config.host}:${config.port}`,
      `/u:${config.username}`,
      `/p:${config.password}`,
      `/t:RDP - ${config.host}`,
      '/cert:ignore',
      '/sec:nla',
      '/tls:seclevel:0',
      '+clipboard',
      '/dynamic-resolution',
      '/network:auto',
      '/gfx',
      '/bpp:32',
      '+auto-reconnect',
    ];

    if (config.fullscreen) {
      args.push('/f');
    } else {
      args.push(`/size:${width}x${height}`);
    }

    if (config.domain) {
      args.push(`/d:${config.domain}`);
    }

    console.log(`[RDPManager] Running: xfreerdp3 ${args.join(' ').replace(config.password, '****')}`);

    const rdpProcess = spawn('xfreerdp3', args, {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let connected = false;

    rdpProcess.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      console.log(`[RDPManager] stdout: ${output}`);
      
      if (!connected && (output.includes('connected') || output.includes('Connection'))) {
        connected = true;
        const conn = this.connections.get(connectionId);
        if (conn) conn.connected = true;
        emitter.emit('connect');
      }
    });

    rdpProcess.stderr?.on('data', (data: Buffer) => {
      const output = data.toString();
      console.log(`[RDPManager] stderr: ${output}`);
      
      if (output.includes('[ERROR]') && 
          !output.includes('CONNECT_CANCELLED') &&
          !output.includes('term_handler') &&
          (output.includes('ERRCONNECT') || 
           output.includes('connect failed') ||
           output.includes('Authentication failure') ||
           output.includes('unable to connect'))) {
        emitter.emit('error', new Error(output.trim()));
      }
    });

    rdpProcess.on('close', (code) => {
      console.log(`[RDPManager] xfreerdp3 exited with code ${code}`);
      this.connections.delete(connectionId);
      emitter.emit('close');
    });

    rdpProcess.on('error', (err) => {
      console.error(`[RDPManager] Process error:`, err);
      emitter.emit('error', err);
    });

    this.connections.set(connectionId, {
      process: rdpProcess,
      connected: false,
      emitter,
      config,
    });

    setTimeout(() => {
      const conn = this.connections.get(connectionId);
      if (conn && !conn.connected) {
        conn.connected = true;
        emitter.emit('connect');
      }
    }, 2000);

    return { emitter, success: true };
  }

  /**
   * Disconnect RDP session
   */
  disconnect(connectionId: string): void {
    const conn = this.connections.get(connectionId);
    if (conn) {
      try {
        if (!conn.process.killed) {
          conn.process.kill('SIGTERM');
        }
        
        if (this.isWindows) {
          const credTarget = `TERMSRV/${conn.config.host}`;
          exec(`cmdkey /delete:"${credTarget}"`, () => {});
          
          if (conn.rdpFilePath && fs.existsSync(conn.rdpFilePath)) {
            fs.unlinkSync(conn.rdpFilePath);
          }
        }
      } catch (err) {
        console.error(`[RDPManager] Error killing process ${connectionId}:`, err);
      }
      this.connections.delete(connectionId);
      console.log(`[RDPManager] Disconnected: ${connectionId}`);
    }
  }

  /**
   * Check if connection exists and is active
   */
  isConnected(connectionId: string): boolean {
    const conn = this.connections.get(connectionId);
    return conn?.connected ?? false;
  }

  /**
   * Close all connections - called when app is closing
   */
  closeAll(): void {
    console.log(`[RDPManager] Closing all ${this.connections.size} RDP connections...`);
    for (const [id, conn] of this.connections) {
      try {
        if (!conn.process.killed) {
          conn.process.kill('SIGTERM');
        }
        
        if (this.isWindows) {
          const credTarget = `TERMSRV/${conn.config.host}`;
          exec(`cmdkey /delete:"${credTarget}"`, () => {});
          
          if (conn.rdpFilePath && fs.existsSync(conn.rdpFilePath)) {
            fs.unlinkSync(conn.rdpFilePath);
          }
        }
      } catch (err) {
        console.error(`[RDPManager] Error closing ${id}:`, err);
      }
    }
    this.connections.clear();
    console.log('[RDPManager] All connections closed');
  }

  /**
   * Focus the RDP window using xdotool (Linux only)
   */
  focusWindow(connectionId: string): void {
    if (this.isWindows) return;
    
    const conn = this.connections.get(connectionId);
    if (conn) {
      const title = `RDP - ${conn.config.host}`;
      const xdotool = spawn('xdotool', ['search', '--name', title, 'windowactivate']);
      xdotool.on('error', (err) => {
        console.error('[RDPManager] xdotool error:', err);
      });
    }
  }

  /**
   * Toggle fullscreen for RDP window (Linux only)
   */
  toggleFullscreen(connectionId: string): void {
    if (this.isWindows) return;
    
    const conn = this.connections.get(connectionId);
    if (conn) {
      const title = `RDP - ${conn.config.host}`;
      const findWindow = spawn('xdotool', ['search', '--name', title]);
      let windowId = '';
      
      findWindow.stdout.on('data', (data) => {
        windowId = data.toString().trim().split('\n')[0];
      });
      
      findWindow.on('close', () => {
        if (windowId) {
          spawn('xdotool', ['windowactivate', '--sync', windowId], {
            stdio: 'ignore'
          }).on('close', () => {
            spawn('xdotool', ['key', '--window', windowId, 'ctrl+alt+Return'], {
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
  sendMouse(connectionId: string, x: number, y: number, button: number, isPressed: boolean): void {}
  sendWheel(connectionId: string, x: number, y: number, step: number, isNegative: boolean, isHorizontal: boolean): void {}
  sendScancode(connectionId: string, code: number, isPressed: boolean): void {}
  sendUnicode(connectionId: string, code: number, isPressed: boolean): void {}
}
