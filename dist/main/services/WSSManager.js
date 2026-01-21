"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WSSManager = void 0;
const events_1 = require("events");
const ws_1 = __importDefault(require("ws"));
class WSSManager extends events_1.EventEmitter {
    constructor() {
        super();
        this.connections = new Map();
    }
    /**
     * Connect to a WebSocket Secure server
     */
    connect(connectionId, config) {
        try {
            console.log(`[WSSManager] Connecting to ${config.url}`);
            const socket = new ws_1.default(config.url, {
                headers: config.headers || {},
                rejectUnauthorized: false, // Allow self-signed certificates
            });
            const connection = {
                socket,
                connected: false,
                url: config.url,
                messageBuffer: [],
            };
            socket.on('open', () => {
                console.log(`[WSSManager] Connected to ${config.url}`);
                connection.connected = true;
                this.emit('connect', connectionId);
            });
            socket.on('message', (data) => {
                const message = data.toString();
                connection.messageBuffer.push(message);
                // Keep only last 1000 messages
                if (connection.messageBuffer.length > 1000) {
                    connection.messageBuffer.shift();
                }
                this.emit('message', connectionId, message);
            });
            socket.on('close', (code, reason) => {
                console.log(`[WSSManager] Disconnected from ${config.url}: ${code} ${reason}`);
                connection.connected = false;
                this.emit('close', connectionId, code, reason.toString());
                this.connections.delete(connectionId);
            });
            socket.on('error', (error) => {
                console.error(`[WSSManager] Error on ${config.url}:`, error.message);
                this.emit('error', connectionId, error.message);
            });
            this.connections.set(connectionId, connection);
            return { success: true };
        }
        catch (error) {
            console.error('[WSSManager] Connection error:', error);
            return { success: false, error: error.message };
        }
    }
    /**
     * Send a message through WebSocket
     */
    send(connectionId, message) {
        const conn = this.connections.get(connectionId);
        if (conn && conn.connected) {
            try {
                conn.socket.send(message);
                return true;
            }
            catch (error) {
                console.error('[WSSManager] Send error:', error);
                return false;
            }
        }
        return false;
    }
    /**
     * Get message history
     */
    getHistory(connectionId) {
        const conn = this.connections.get(connectionId);
        return conn?.messageBuffer || [];
    }
    /**
     * Disconnect from WebSocket server
     */
    disconnect(connectionId) {
        const conn = this.connections.get(connectionId);
        if (conn) {
            try {
                // Remove all listeners first to prevent events after disconnect
                conn.socket.removeAllListeners();
                // Check socket state: 0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED
                if (conn.socket.readyState === ws_1.default.CONNECTING) {
                    // If still connecting, terminate immediately
                    conn.socket.terminate();
                }
                else if (conn.socket.readyState === ws_1.default.OPEN) {
                    // If connected, close gracefully
                    conn.socket.close(1000, 'User disconnected');
                }
                // If CLOSING or CLOSED, nothing to do
            }
            catch (err) {
                console.error(`[WSSManager] Error closing ${connectionId}:`, err);
            }
            this.connections.delete(connectionId);
            console.log(`[WSSManager] Disconnected: ${connectionId}`);
        }
    }
    /**
     * Check if connection is active
     */
    isConnected(connectionId) {
        const conn = this.connections.get(connectionId);
        return conn?.connected ?? false;
    }
    /**
     * Close all connections
     */
    closeAll() {
        for (const [id] of this.connections) {
            this.disconnect(id);
        }
    }
}
exports.WSSManager = WSSManager;
//# sourceMappingURL=WSSManager.js.map