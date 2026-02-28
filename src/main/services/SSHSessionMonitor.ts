/**
 * SSH Session Monitor Service
 * 
 * Lightweight monitoring for SSH sessions:
 * - Latency measurement (RTT) via TCP ping to SSH port
 * - Connection stability tracking
 * - Shell channel health detection
 * 
 * Design principles:
 * - No heavy dashboards or charts
 * - Minimal CPU/memory overhead
 * - Auto-cleanup on session close
 * - Non-blocking async operations
 */

import * as net from 'net';
import { EventEmitter } from 'events';

// Configuration
const LATENCY_CHECK_INTERVAL = 10000; // 10 seconds
const LATENCY_SAMPLES = 10; // Rolling average of last 10 samples
const TCP_PING_TIMEOUT = 5000; // 5 second timeout for TCP ping
const STALL_THRESHOLD = 60000; // 60 seconds without response = stalled
const INITIAL_DELAY = 2000; // Wait 2 seconds before first health check

// Latency thresholds (milliseconds)
export const LATENCY_THRESHOLDS = {
  STABLE: 100,      // Green: < 100ms
  HIGH: 300,        // Yellow: 100-300ms
  VERY_HIGH: 300,   // Red: > 300ms
};

// Throughput calculation interval
const THROUGHPUT_CALC_INTERVAL = 1000; // Calculate every 1 second

export type LatencyStatus = 'stable' | 'high' | 'very-high' | 'unknown';
export type ConnectionStatus = 'connected' | 'unstable' | 'stalled' | 'disconnected';
export type ShellStatus = 'active' | 'idle' | 'not-responding' | 'closed';

export interface SessionMonitorData {
  connectionId: string;
  latency: number; // Current RTT in ms
  latencyStatus: LatencyStatus;
  latencyAverage: number; // Rolling average
  connectionStatus: ConnectionStatus;
  shellStatus: ShellStatus;
  keepaliveFailures: number;
  reconnectAttempts: number;
  lastActivity: number; // Timestamp
  isMonitoring: boolean;
  warning?: string;
  // Throughput data
  downloadSpeed: number; // bytes per second
  uploadSpeed: number; // bytes per second
  totalDownload: number; // total bytes received
  totalUpload: number; // total bytes sent
}

interface MonitorSession {
  connectionId: string;
  host: string;
  port: number;
  latencySamples: number[];
  keepaliveFailures: number;
  reconnectAttempts: number;
  lastActivity: number;
  lastShellOutput: number;
  checkInterval: NodeJS.Timeout | null;
  throughputInterval: NodeJS.Timeout | null;
  isShellResponding: boolean;
  isConnected: boolean;
  // Throughput tracking
  bytesReceived: number;
  bytesSent: number;
  lastBytesReceived: number;
  lastBytesSent: number;
  downloadSpeed: number;
  uploadSpeed: number;
}

export class SSHSessionMonitor extends EventEmitter {
  private sessions: Map<string, MonitorSession> = new Map();
  private enabled: boolean = true;

  constructor() {
    super();
  }

  /**
   * Enable or disable monitoring globally
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      // Stop all active monitors
      for (const session of this.sessions.values()) {
        this.stopMonitoringInternal(session);
      }
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Start monitoring a session using TCP ping
   * @param connectionId - Format: user@host:port
   */
  startMonitoring(connectionId: string): void {
    if (!this.enabled) return;
    
    // Don't start if already monitoring
    if (this.sessions.has(connectionId)) {
      console.log('[SessionMonitor] Already monitoring:', connectionId);
      return;
    }

    // Parse connectionId to get host and port (format: user@host:port or user@host:port-timestamp)
    const match = connectionId.match(/@([^:@]+):(\d+)(?:-\d+)?$/);
    if (!match) {
      console.log('[SessionMonitor] Invalid connectionId format:', connectionId);
      return;
    }

    const host = match[1];
    const port = parseInt(match[2], 10);

    console.log('[SessionMonitor] Starting monitor for:', connectionId, `(${host}:${port})`);

    const session: MonitorSession = {
      connectionId,
      host,
      port,
      latencySamples: [],
      keepaliveFailures: 0,
      reconnectAttempts: 0,
      lastActivity: Date.now(),
      lastShellOutput: Date.now(),
      checkInterval: null,
      throughputInterval: null,
      isShellResponding: true,
      isConnected: true,
      // Throughput tracking
      bytesReceived: 0,
      bytesSent: 0,
      lastBytesReceived: 0,
      lastBytesSent: 0,
      downloadSpeed: 0,
      uploadSpeed: 0,
    };

    // Start periodic health checks after initial delay
    setTimeout(() => {
      // Check if session still exists (might have been stopped)
      if (!this.sessions.has(connectionId)) return;
      
      session.checkInterval = setInterval(() => {
        this.performHealthCheck(session);
      }, LATENCY_CHECK_INTERVAL);

      // Start throughput calculation
      session.throughputInterval = setInterval(() => {
        this.calculateThroughput(session);
      }, THROUGHPUT_CALC_INTERVAL);

      // Initial check
      this.performHealthCheck(session);
    }, INITIAL_DELAY);

    this.sessions.set(connectionId, session);
  }

  /**
   * Stop monitoring a session
   */
  stopMonitoring(connectionId: string): void {
    const session = this.sessions.get(connectionId);
    if (session) {
      this.stopMonitoringInternal(session);
      this.sessions.delete(connectionId);
      console.log('[SessionMonitor] Stopped monitor for:', connectionId);
    }
  }

  private stopMonitoringInternal(session: MonitorSession): void {
    if (session.checkInterval) {
      clearInterval(session.checkInterval);
      session.checkInterval = null;
    }
    if (session.throughputInterval) {
      clearInterval(session.throughputInterval);
      session.throughputInterval = null;
    }
  }

  /**
   * Perform a health check using TCP ping to SSH port
   */
  private async performHealthCheck(session: MonitorSession): Promise<void> {
    if (!this.enabled) return;

    const startTime = Date.now();
    
    try {
      // TCP ping - connect to SSH port and measure time
      await this.tcpPing(session.host, session.port, TCP_PING_TIMEOUT);
      
      const latency = Date.now() - startTime;
      session.lastActivity = Date.now();
      session.isShellResponding = true;
      session.isConnected = true;
      
      // Update latency samples (rolling)
      session.latencySamples.push(latency);
      if (session.latencySamples.length > LATENCY_SAMPLES) {
        session.latencySamples.shift();
      }

      // Reset keepalive failures on successful check
      if (session.keepaliveFailures > 0) {
        session.keepaliveFailures = Math.max(0, session.keepaliveFailures - 1);
      }

      console.log('[SessionMonitor] TCP ping OK:', session.connectionId, latency + 'ms');
      this.emitUpdate(session);
    } catch (err: any) {
      console.log('[SessionMonitor] TCP ping failed:', session.connectionId, err.message);
      session.keepaliveFailures++;
      session.isConnected = false;
      this.emitUpdate(session);
    }
  }

  /**
   * TCP ping - measure time to connect to a TCP port
   */
  private tcpPing(host: string, port: number, timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      let resolved = false;

      const cleanup = () => {
        socket.removeAllListeners();
        socket.destroy();
      };

      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          reject(new Error('TCP ping timeout'));
        }
      }, timeout);

      socket.on('connect', () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          cleanup();
          resolve();
        }
      });

      socket.on('error', (err) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          cleanup();
          reject(err);
        }
      });

      socket.connect(port, host);
    });
  }

  /**
   * Calculate throughput (called every second)
   */
  private calculateThroughput(session: MonitorSession): void {
    const downloadDelta = session.bytesReceived - session.lastBytesReceived;
    const uploadDelta = session.bytesSent - session.lastBytesSent;
    
    session.downloadSpeed = downloadDelta; // bytes per second
    session.uploadSpeed = uploadDelta; // bytes per second
    
    session.lastBytesReceived = session.bytesReceived;
    session.lastBytesSent = session.bytesSent;
    
    // Always emit update so UI shows current speed (even 0 B/s)
    this.emitUpdate(session);
  }

  /**
   * Record bytes received (download - data from server)
   */
  recordBytesReceived(connectionId: string, bytes: number): void {
    const session = this.sessions.get(connectionId);
    if (session) {
      session.bytesReceived += bytes;
      session.lastActivity = Date.now();
      session.lastShellOutput = Date.now();
      session.isShellResponding = true;
    }
  }

  /**
   * Record bytes sent (upload - data to server)
   */
  recordBytesSent(connectionId: string, bytes: number): void {
    const session = this.sessions.get(connectionId);
    if (session) {
      session.bytesSent += bytes;
      session.lastActivity = Date.now();
    }
  }

  /**
   * Mark session as disconnected (called from outside when connection closes)
   */
  markDisconnected(connectionId: string): void {
    const session = this.sessions.get(connectionId);
    if (session) {
      session.isConnected = false;
      this.emitUpdate(session);
      this.stopMonitoring(connectionId);
      this.emit('session-closed', connectionId);
    }
  }

  /**
   * Record shell activity (called when shell receives data)
   * @deprecated Use recordBytesReceived instead
   */
  recordShellActivity(connectionId: string): void {
    const session = this.sessions.get(connectionId);
    if (session) {
      session.lastShellOutput = Date.now();
      session.isShellResponding = true;
    }
  }

  /**
   * Record reconnect attempt
   */
  recordReconnectAttempt(connectionId: string): void {
    const session = this.sessions.get(connectionId);
    if (session) {
      session.reconnectAttempts++;
      this.emitUpdate(session);
    }
  }

  /**
   * Get current monitor data for a session
   */
  getSessionData(connectionId: string): SessionMonitorData | null {
    const session = this.sessions.get(connectionId);
    if (!session) return null;
    return this.buildSessionData(session);
  }

  /**
   * Get all monitored sessions data
   */
  getAllSessionsData(): SessionMonitorData[] {
    return Array.from(this.sessions.values()).map(s => this.buildSessionData(s));
  }

  /**
   * Build session data object
   */
  private buildSessionData(session: MonitorSession): SessionMonitorData {
    const latency = session.latencySamples.length > 0 
      ? session.latencySamples[session.latencySamples.length - 1] 
      : 0;
    
    const latencyAverage = session.latencySamples.length > 0
      ? Math.round(session.latencySamples.reduce((a, b) => a + b, 0) / session.latencySamples.length)
      : 0;

    const latencyStatus = this.getLatencyStatus(latency);
    const connectionStatus = this.getConnectionStatus(session);
    const shellStatus = this.getShellStatus(session);
    const warning = this.getWarning(session, connectionStatus, shellStatus);

    return {
      connectionId: session.connectionId,
      latency,
      latencyStatus,
      latencyAverage,
      connectionStatus,
      shellStatus,
      keepaliveFailures: session.keepaliveFailures,
      reconnectAttempts: session.reconnectAttempts,
      lastActivity: session.lastActivity,
      isMonitoring: this.enabled && session.checkInterval !== null,
      warning,
      // Throughput data
      downloadSpeed: session.downloadSpeed,
      uploadSpeed: session.uploadSpeed,
      totalDownload: session.bytesReceived,
      totalUpload: session.bytesSent,
    };
  }

  /**
   * Determine latency status from RTT value
   */
  private getLatencyStatus(latency: number): LatencyStatus {
    if (latency === 0) return 'unknown';
    if (latency < LATENCY_THRESHOLDS.STABLE) return 'stable';
    if (latency < LATENCY_THRESHOLDS.HIGH) return 'high';
    return 'very-high';
  }

  /**
   * Determine connection status
   */
  private getConnectionStatus(session: MonitorSession): ConnectionStatus {
    const timeSinceActivity = Date.now() - session.lastActivity;
    
    if (timeSinceActivity > STALL_THRESHOLD) {
      return 'stalled';
    }
    
    if (session.keepaliveFailures >= 2) {
      return 'unstable';
    }
    
    return 'connected';
  }

  /**
   * Determine shell status
   */
  private getShellStatus(session: MonitorSession): ShellStatus {
    const timeSinceOutput = Date.now() - session.lastShellOutput;
    
    if (!session.isShellResponding) {
      return 'not-responding';
    }
    
    // Idle if no output for 60 seconds (but connection still alive)
    if (timeSinceOutput > 60000) {
      return 'idle';
    }
    
    return 'active';
  }

  /**
   * Get warning message if any issues
   */
  private getWarning(session: MonitorSession, connStatus: ConnectionStatus, shellStatus: ShellStatus): string | undefined {
    if (connStatus === 'stalled') {
      return 'Connection stalled - no response';
    }
    if (connStatus === 'unstable') {
      return 'Connection unstable';
    }
    if (shellStatus === 'not-responding') {
      return 'Shell not responding';
    }
    if (session.keepaliveFailures > 0) {
      return `Keepalive timeout (${session.keepaliveFailures})`;
    }
    return undefined;
  }

  /**
   * Emit update event with session data
   */
  private emitUpdate(session: MonitorSession): void {
    const data = this.buildSessionData(session);
    this.emit('update', data);
  }

  /**
   * Cleanup all sessions
   */
  cleanup(): void {
    for (const [id, session] of this.sessions) {
      this.stopMonitoringInternal(session);
    }
    this.sessions.clear();
    this.removeAllListeners();
    console.log('[SessionMonitor] Cleanup complete');
  }
}

// Singleton instance
export const sessionMonitor = new SSHSessionMonitor();
