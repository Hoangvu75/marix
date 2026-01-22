import { EventEmitter } from 'events';
import WebSocket from 'ws';

interface WSSConnection {
  socket: WebSocket | null;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  url: string;
  messageBuffer: string[];
}

export class WSSManager extends EventEmitter {
  private connections: Map<string, WSSConnection> = new Map();

  constructor() {
    super();
  }

  /**
   * Connect to a WebSocket server
   */
  async connect(
    connectionId: string,
    config: {
      url: string;
      headers?: Record<string, string>;
    }
  ): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      try {
        // Validate URL
        let url = config.url;
        if (!url) {
          resolve({ success: false, error: 'URL is required' });
          return;
        }

        // Add wss:// if no protocol specified
        if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
          url = `wss://${url}`;
        }

        console.log(`[WSSManager] Connecting to ${url}`);

        // Create connection record first
        const connection: WSSConnection = {
          socket: null,
          status: 'connecting',
          url,
          messageBuffer: [],
        };
        this.connections.set(connectionId, connection);

        // Create WebSocket with timeout
        const socket = new WebSocket(url, {
          headers: config.headers || {},
          rejectUnauthorized: false,
          handshakeTimeout: 15000,
        });

        connection.socket = socket;

        let resolved = false;
        const safeResolve = (result: { success: boolean; error?: string }) => {
          if (!resolved) {
            resolved = true;
            resolve(result);
          }
        };

        // Connection timeout
        const timeout = setTimeout(() => {
          if (connection.status === 'connecting') {
            console.log(`[WSSManager] Connection timeout for ${connectionId}`);
            connection.status = 'error';
            this.safeClose(socket);
            this.connections.delete(connectionId);
            safeResolve({ success: false, error: 'Connection timeout (15s)' });
          }
        }, 15000);

        socket.onopen = () => {
          clearTimeout(timeout);
          console.log(`[WSSManager] Connected to ${url}`);
          connection.status = 'connected';
          this.emit('connect', connectionId);
          safeResolve({ success: true });
        };

        socket.onmessage = (event) => {
          if (this.connections.has(connectionId)) {
            const message = event.data.toString();
            console.log(`[WSSManager] Message from ${connectionId}:`, message.substring(0, 100));
            connection.messageBuffer.push(message);
            if (connection.messageBuffer.length > 1000) {
              connection.messageBuffer.shift();
            }
            this.emit('message', connectionId, message);
          }
        };

        socket.onclose = (event) => {
          clearTimeout(timeout);
          console.log(`[WSSManager] Closed ${connectionId}: ${event.code} ${event.reason}`);
          
          const wasConnecting = connection.status === 'connecting';
          connection.status = 'disconnected';
          this.connections.delete(connectionId);
          
          this.emit('close', connectionId, event.code, event.reason || '');
          
          if (wasConnecting) {
            safeResolve({ success: false, error: `Connection closed: ${event.code}` });
          }
        };

        socket.onerror = (event) => {
          clearTimeout(timeout);
          const errorMsg = (event as any).message || 'Connection error';
          console.error(`[WSSManager] Error on ${connectionId}:`, errorMsg);
          
          const wasConnecting = connection.status === 'connecting';
          connection.status = 'error';
          
          this.emit('error', connectionId, errorMsg);
          
          if (wasConnecting) {
            this.connections.delete(connectionId);
            safeResolve({ success: false, error: errorMsg });
          }
        };

      } catch (error: any) {
        console.error('[WSSManager] Exception:', error);
        this.connections.delete(connectionId);
        resolve({ success: false, error: error.message });
      }
    });
  }

  /**
   * Safely close a WebSocket
   */
  private safeClose(socket: WebSocket | null): void {
    if (!socket) return;
    
    try {
      socket.removeAllListeners?.();
      socket.onopen = null;
      socket.onmessage = null;
      socket.onclose = null;
      socket.onerror = null;
      
      if (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN) {
        socket.close(1000);
      }
    } catch (e) {
      // Ignore
    }
  }

  /**
   * Send a message
   */
  send(connectionId: string, message: string): boolean {
    const conn = this.connections.get(connectionId);
    if (conn?.socket && conn.status === 'connected') {
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
    return this.connections.get(connectionId)?.messageBuffer || [];
  }

  /**
   * Disconnect
   */
  disconnect(connectionId: string): void {
    console.log(`[WSSManager] Disconnect requested: ${connectionId}`);
    
    const conn = this.connections.get(connectionId);
    if (!conn) {
      console.log(`[WSSManager] No connection found: ${connectionId}`);
      return;
    }

    // Remove from map immediately
    this.connections.delete(connectionId);
    
    // Close socket safely
    this.safeClose(conn.socket);
    
    console.log(`[WSSManager] Disconnected: ${connectionId}`);
  }

  /**
   * Check connection status
   */
  isConnected(connectionId: string): boolean {
    const conn = this.connections.get(connectionId);
    return conn?.status === 'connected';
  }

  /**
   * Get connection status
   */
  getStatus(connectionId: string): string {
    return this.connections.get(connectionId)?.status || 'disconnected';
  }

  /**
   * Get the number of active connections
   */
  getActiveCount(): number {
    return this.connections.size;
  }

  /**
   * Close all connections
   */
  closeAll(): void {
    console.log(`[WSSManager] Closing all ${this.connections.size} connections`);
    for (const [id] of this.connections) {
      this.disconnect(id);
    }
  }
}
