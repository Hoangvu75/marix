"use strict";
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
exports.sessionMonitor = exports.SSHSessionMonitor = exports.LATENCY_THRESHOLDS = void 0;
const net = __importStar(require("net"));
const events_1 = require("events");
// Configuration
const LATENCY_CHECK_INTERVAL = 10000; // 10 seconds
const LATENCY_SAMPLES = 10; // Rolling average of last 10 samples
const TCP_PING_TIMEOUT = 5000; // 5 second timeout for TCP ping
const STALL_THRESHOLD = 60000; // 60 seconds without response = stalled
const INITIAL_DELAY = 2000; // Wait 2 seconds before first health check
// Latency thresholds (milliseconds)
exports.LATENCY_THRESHOLDS = {
    STABLE: 100, // Green: < 100ms
    HIGH: 300, // Yellow: 100-300ms
    VERY_HIGH: 300, // Red: > 300ms
};
// Throughput calculation interval
const THROUGHPUT_CALC_INTERVAL = 1000; // Calculate every 1 second
class SSHSessionMonitor extends events_1.EventEmitter {
    constructor() {
        super();
        this.sessions = new Map();
        this.enabled = true;
    }
    /**
     * Enable or disable monitoring globally
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        if (!enabled) {
            // Stop all active monitors
            for (const session of this.sessions.values()) {
                this.stopMonitoringInternal(session);
            }
        }
    }
    isEnabled() {
        return this.enabled;
    }
    /**
     * Start monitoring a session using TCP ping
     * @param connectionId - Format: user@host:port
     */
    startMonitoring(connectionId) {
        if (!this.enabled)
            return;
        // Don't start if already monitoring
        if (this.sessions.has(connectionId)) {
            console.log('[SessionMonitor] Already monitoring:', connectionId);
            return;
        }
        // Parse connectionId to get host and port (format: user@host:port)
        const match = connectionId.match(/@(.+):(\d+)$/);
        if (!match) {
            console.log('[SessionMonitor] Invalid connectionId format:', connectionId);
            return;
        }
        const host = match[1];
        const port = parseInt(match[2], 10);
        console.log('[SessionMonitor] Starting monitor for:', connectionId, `(${host}:${port})`);
        const session = {
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
            if (!this.sessions.has(connectionId))
                return;
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
    stopMonitoring(connectionId) {
        const session = this.sessions.get(connectionId);
        if (session) {
            this.stopMonitoringInternal(session);
            this.sessions.delete(connectionId);
            console.log('[SessionMonitor] Stopped monitor for:', connectionId);
        }
    }
    stopMonitoringInternal(session) {
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
    async performHealthCheck(session) {
        if (!this.enabled)
            return;
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
        }
        catch (err) {
            console.log('[SessionMonitor] TCP ping failed:', session.connectionId, err.message);
            session.keepaliveFailures++;
            session.isConnected = false;
            this.emitUpdate(session);
        }
    }
    /**
     * TCP ping - measure time to connect to a TCP port
     */
    tcpPing(host, port, timeout) {
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
    calculateThroughput(session) {
        const downloadDelta = session.bytesReceived - session.lastBytesReceived;
        const uploadDelta = session.bytesSent - session.lastBytesSent;
        session.downloadSpeed = downloadDelta; // bytes per second
        session.uploadSpeed = uploadDelta; // bytes per second
        session.lastBytesReceived = session.bytesReceived;
        session.lastBytesSent = session.bytesSent;
        // Only emit update if there's activity
        if (downloadDelta > 0 || uploadDelta > 0) {
            this.emitUpdate(session);
        }
    }
    /**
     * Record bytes received (download - data from server)
     */
    recordBytesReceived(connectionId, bytes) {
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
    recordBytesSent(connectionId, bytes) {
        const session = this.sessions.get(connectionId);
        if (session) {
            session.bytesSent += bytes;
            session.lastActivity = Date.now();
        }
    }
    /**
     * Mark session as disconnected (called from outside when connection closes)
     */
    markDisconnected(connectionId) {
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
    recordShellActivity(connectionId) {
        const session = this.sessions.get(connectionId);
        if (session) {
            session.lastShellOutput = Date.now();
            session.isShellResponding = true;
        }
    }
    /**
     * Record reconnect attempt
     */
    recordReconnectAttempt(connectionId) {
        const session = this.sessions.get(connectionId);
        if (session) {
            session.reconnectAttempts++;
            this.emitUpdate(session);
        }
    }
    /**
     * Get current monitor data for a session
     */
    getSessionData(connectionId) {
        const session = this.sessions.get(connectionId);
        if (!session)
            return null;
        return this.buildSessionData(session);
    }
    /**
     * Get all monitored sessions data
     */
    getAllSessionsData() {
        return Array.from(this.sessions.values()).map(s => this.buildSessionData(s));
    }
    /**
     * Build session data object
     */
    buildSessionData(session) {
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
    getLatencyStatus(latency) {
        if (latency === 0)
            return 'unknown';
        if (latency < exports.LATENCY_THRESHOLDS.STABLE)
            return 'stable';
        if (latency < exports.LATENCY_THRESHOLDS.HIGH)
            return 'high';
        return 'very-high';
    }
    /**
     * Determine connection status
     */
    getConnectionStatus(session) {
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
    getShellStatus(session) {
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
    getWarning(session, connStatus, shellStatus) {
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
    emitUpdate(session) {
        const data = this.buildSessionData(session);
        this.emit('update', data);
    }
    /**
     * Cleanup all sessions
     */
    cleanup() {
        for (const [id, session] of this.sessions) {
            this.stopMonitoringInternal(session);
        }
        this.sessions.clear();
        this.removeAllListeners();
        console.log('[SessionMonitor] Cleanup complete');
    }
}
exports.SSHSessionMonitor = SSHSessionMonitor;
// Singleton instance
exports.sessionMonitor = new SSHSessionMonitor();
//# sourceMappingURL=SSHSessionMonitor.js.map