import { EventEmitter } from 'events';
import WebSocket from 'ws';

interface WSSConnection {
  socket: WebSocket;
  connected: boolean;
  url: string;
  messageBuffer: string[];
}

export class WSSManager extends EventEmitter {
  private connections: Map<string, WSSConnection> = new Map();

  constructor() {
    super();
  }

  /**
   * Connect to a WebSocket Secure server
   */
  connect(
    connectionId: string,
    config: {
      url: string;
      headers?: Record<string, string>;
    }
  ): { success: boolean; error?: string } {
    try {
      console.log(`[WSSManager] Connecting to ${config.url}`);

      const socket = new WebSocket(config.url, {
        headers: config.headers || {},
        rejectUnauthorized: false, // Allow self-signed certificates
      });

      const connection: WSSConnection = {
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

      socket.on('message', (data: WebSocket.Data) => {
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
    } catch (error: any) {
      console.error('[WSSManager] Connection error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send a message through WebSocket
   */
  send(connectionId: string, message: string): boolean {
    const conn = this.connections.get(connectionId);
    if (conn && conn.connected) {
      try {
        conn.socket.send(message);
        return true;
      } catch (error) {
        console.error('[WSSManager] Send error:', error);
        return false;
      }
    }
    return false;
  }

  /**
   * Get message history
   */
  getHistory(connectionId: string): string[] {
    const conn = this.connections.get(connectionId);
    return conn?.messageBuffer || [];
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(connectionId: string): void {
    const conn = this.connections.get(connectionId);
    if (conn) {
      try {
        conn.socket.close(1000, 'User disconnected');
      } catch (err) {
        console.error(`[WSSManager] Error closing ${connectionId}:`, err);
      }
      this.connections.delete(connectionId);
      console.log(`[WSSManager] Disconnected: ${connectionId}`);
    }
  }

  /**
   * Check if connection is active
   */
  isConnected(connectionId: string): boolean {
    const conn = this.connections.get(connectionId);
    return conn?.connected ?? false;
  }

  /**
   * Close all connections
   */
  closeAll(): void {
    for (const [id] of this.connections) {
      this.disconnect(id);
    }
  }
}
