/**
 * LAN Sharing Service
 * Share server configurations over local network
 */

import * as dgram from 'dgram';
import * as crypto from 'crypto';
import * as os from 'os';
import { EventEmitter } from 'events';

interface SharePacket {
  type: 'announce' | 'share' | 'request' | 'response' | 'ack' | 'find-sender' | 'sender-found';
  deviceId: string;
  deviceName: string;
  timestamp: number;
  data?: any;
  code?: string;
}

interface PeerDevice {
  id: string;
  name: string;
  address: string;
  port: number;
  lastSeen: number;
}

export class LANSharingService extends EventEmitter {
  private socket: dgram.Socket | null = null;
  private isRunning = false;
  private deviceId: string;
  private deviceName: string;
  private discoveryPort = 45678;
  private multicastAddress = '224.0.0.88'; // Use  multicast IP
  private peers: Map<string, PeerDevice> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private announceInterval: NodeJS.Timeout | null = null;
  private peerTimeoutMs = 30000; // 30 seconds

  constructor() {
    super();
    this.deviceId = this.generateDeviceId();
    this.deviceName = os.hostname() || 'Unknown Device';
  }

  private generateDeviceId(): string {
    // Generate stable device ID from hostname + MAC address
    // This ensures same device always has same ID (no duplicates)
    const hostname = os.hostname();
    const interfaces = os.networkInterfaces();
    
    // Find first non-internal MAC address
    let macAddress = '';
    for (const name of Object.keys(interfaces)) {
      const netInterface = interfaces[name];
      if (!netInterface) continue;
      
      for (const net of netInterface) {
        // Skip internal (loopback) and IPv6
        if (!net.internal && net.mac && net.mac !== '00:00:00:00:00:00') {
          macAddress = net.mac;
          break;
        }
      }
      if (macAddress) break;
    }
    
    // Hash hostname + MAC to create stable unique ID
    const source = `${hostname}-${macAddress}`;
    return crypto.createHash('sha256').update(source).digest('hex').substring(0, 32);
  }

  /**
   * Generate a 6-digit pairing code
   */
  generatePairingCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Start the LAN sharing service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[LANSharing] Service already running');
      return;
    }

    return new Promise((resolve, reject) => {
      console.log('[LANSharing] Starting service...');
      this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

      this.socket.on('error', (err) => {
        console.error('[LANSharing] Socket error:', err);
        this.emit('error', err);
        reject(err);
      });

      this.socket.on('message', (msg, rinfo) => {
        console.log(`[LANSharing] Received ${msg.length} bytes from ${rinfo.address}:${rinfo.port}`);
        this.handleMessage(msg, rinfo);
      });

      this.socket.on('listening', () => {
        const address = this.socket!.address();
        console.log(`[LANSharing] Socket listening on ${address.address}:${address.port}`);
        this.isRunning = true;

        // Join Marix-specific multicast group
        try {
          this.socket!.addMembership(this.multicastAddress);
          console.log(`[LANSharing] Joined Marix multicast group ${this.multicastAddress}`);
        } catch (err) {
          console.error('[LANSharing] Failed to join multicast group:', err);
        }

        // Enable broadcast as fallback (for local network)
        this.socket!.setBroadcast(true);
        console.log('[LANSharing] Broadcast enabled as fallback');

        // Start announcing presence
        this.startAnnouncing();

        // Start cleanup timer
        this.startCleanup();

        console.log(`[LANSharing] Service started - Device ID: ${this.deviceId}, Name: ${this.deviceName}`);
        resolve();
      });

      // Bind to all interfaces
      console.log(`[LANSharing] Binding to 0.0.0.0:${this.discoveryPort}`);
      this.socket.bind(this.discoveryPort, '0.0.0.0');
    });
  }

  /**
   * Stop the service
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('[LANSharing] Service not running');
      return;
    }

    console.log('[LANSharing] Stopping service...');

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    if (this.announceInterval) {
      clearInterval(this.announceInterval);
      this.announceInterval = null;
    }

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    this.isRunning = false;
    this.peers.clear();
    console.log('[LANSharing] Service stopped');
  }

  /**
   * Announce presence on the network
   */
  private startAnnouncing(): void {
    const announce = () => {
      if (!this.isRunning) {
        console.log('[LANSharing] Not announcing, service not running');
        return;
      }

      const packet: SharePacket = {
        type: 'announce',
        deviceId: this.deviceId,
        deviceName: this.deviceName,
        timestamp: Date.now(),
      };

      console.log(`[LANSharing] Broadcasting announce packet - Device: ${this.deviceName}, ID: ${this.deviceId}`);
      this.broadcast(packet);
    };

    // Announce immediately
    console.log('[LANSharing] Starting announce broadcasts');
    announce();

    // Then announce every 5 seconds (faster discovery)
    this.announceInterval = setInterval(announce, 5000);
  }

  /**
   * Broadcast packet to the network
   */
  private broadcast(packet: SharePacket): void {
    if (!this.socket || !this.isRunning) {
      console.log('[LANSharing] Cannot broadcast - socket or service not ready');
      return;
    }

    const message = Buffer.from(JSON.stringify(packet));
    console.log(`[LANSharing] Broadcasting ${packet.type} packet (${message.length} bytes) to multicast ${this.multicastAddress}:${this.discoveryPort}`);
    
    // Send to multicast group (like LocalSend)
    this.socket.send(message, this.discoveryPort, this.multicastAddress, (err) => {
      if (err) {
        console.error('[LANSharing] Multicast send error:', err);
      } else {
        console.log(`[LANSharing] Multicast sent successfully`);
      }
    });
    
    // Also send to broadcast as fallback for devices that don't support multicast
    this.socket.send(message, this.discoveryPort, '255.255.255.255', (err) => {
      if (err) {
        console.error('[LANSharing] Broadcast fallback error:', err);
      }
    });
  }

  /**
   * Send packet to specific peer
   */
  private sendTo(packet: SharePacket, address: string, port: number): void {
    if (!this.socket || !this.isRunning) return;

    const message = Buffer.from(JSON.stringify(packet));
    this.socket.send(message, port, address, (err) => {
      if (err) {
        console.error('[LANSharing] Send error:', err);
      }
    });
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(msg: Buffer, rinfo: dgram.RemoteInfo): void {
    try {
      console.log(`[LANSharing] Parsing message: ${msg.toString().substring(0, 100)}...`);
      const packet: SharePacket = JSON.parse(msg.toString());

      console.log(`[LANSharing] Received ${packet.type} from device ${packet.deviceName} (${packet.deviceId})`);

      // Ignore own messages
      if (packet.deviceId === this.deviceId) {
        console.log('[LANSharing] Ignoring own message');
        return;
      }

      switch (packet.type) {
        case 'announce':
          console.log(`[LANSharing] Processing announce from ${packet.deviceName}`);
          this.handleAnnounce(packet, rinfo);
          break;
        case 'share':
          this.handleShare(packet, rinfo);
          break;
        case 'request':
          this.handleRequest(packet, rinfo);
          break;
        case 'response':
          this.handleResponse(packet, rinfo);
          break;
        case 'ack':
          this.handleAck(packet, rinfo);
          break;
        case 'find-sender':
          this.handleFindSender(packet, rinfo);
          break;
        case 'sender-found':
          this.handleSenderFound(packet, rinfo);
          break;
      }
    } catch (err) {
      console.error('[LANSharing] Failed to parse message:', err);
      console.error('[LANSharing] Raw message:', msg.toString());
    }
  }

  /**
   * Handle device announcement
   */
  private handleAnnounce(packet: SharePacket, rinfo: dgram.RemoteInfo): void {
    const peer: PeerDevice = {
      id: packet.deviceId,
      name: packet.deviceName,
      address: rinfo.address,
      port: rinfo.port,
      lastSeen: Date.now(),
    };

    const isNew = !this.peers.has(peer.id);
    this.peers.set(peer.id, peer);

    if (isNew) {
      console.log(`[LANSharing] ✓ NEW PEER DISCOVERED: ${peer.name} at ${peer.address}:${peer.port}`);
      console.log(`[LANSharing] Total peers: ${this.peers.size}`);
      this.emit('peer-found', peer);
    } else {
      console.log(`[LANSharing] Updated peer: ${peer.name} at ${peer.address}`);
    }
  }

  /**
   * Handle incoming share
   */
  private handleShare(packet: SharePacket, rinfo: dgram.RemoteInfo): void {
    console.log(`[LANSharing] Received share from ${packet.deviceName}`);
    this.emit('share-received', {
      from: packet.deviceName,
      deviceId: packet.deviceId,
      data: packet.data,
      code: packet.code,
      address: rinfo.address,
    });
  }

  /**
   * Handle share request
   */
  private handleRequest(packet: SharePacket, rinfo: dgram.RemoteInfo): void {
    console.log(`[LANSharing] Received request from ${packet.deviceName}`);
    this.emit('share-request', {
      from: packet.deviceName,
      deviceId: packet.deviceId,
      code: packet.code,
      address: rinfo.address,
      port: rinfo.port,
    });
  }

  /**
   * Handle share response
   */
  private handleResponse(packet: SharePacket, rinfo: dgram.RemoteInfo): void {
    this.emit('share-response', {
      from: packet.deviceName,
      data: packet.data,
    });
  }

  /**
   * Handle acknowledgment from receiver
   */
  private handleAck(packet: SharePacket, rinfo: dgram.RemoteInfo): void {
    console.log(`[LANSharing] Received ACK from ${packet.deviceName}:`, packet.data);
    this.emit('share-ack', {
      from: packet.deviceName,
      deviceId: packet.deviceId,
      data: packet.data,
    });
  }

  /**
   * Send acknowledgment to peer
   */
  sendAck(peerId: string, data: any): boolean {
    const peer = this.peers.get(peerId);
    if (!peer) {
      console.error('[LANSharing] Peer not found for ACK:', peerId);
      return false;
    }

    const packet: SharePacket = {
      type: 'ack',
      deviceId: this.deviceId,
      deviceName: this.deviceName,
      timestamp: Date.now(),
      data,
    };

    this.sendTo(packet, peer.address, peer.port);
    console.log(`[LANSharing] Sent ACK to ${peer.name}`);
    return true;
  }

  /**
   * Share servers with a specific peer
   */
  shareWithPeer(peerId: string, servers: any[], pairingCode: string): boolean {
    const peer = this.peers.get(peerId);
    if (!peer) {
      console.error('[LANSharing] Peer not found:', peerId);
      return false;
    }

    // Encrypt data with pairing code
    const encrypted = this.encrypt(JSON.stringify(servers), pairingCode);

    const packet: SharePacket = {
      type: 'share',
      deviceId: this.deviceId,
      deviceName: this.deviceName,
      timestamp: Date.now(),
      data: encrypted,
      code: pairingCode,
    };

    this.sendTo(packet, peer.address, peer.port);
    console.log(`[LANSharing] Shared ${servers.length} servers with ${peer.name}`);
    return true;
  }

  /**
   * Request share from peer with pairing code
   */
  requestFromPeer(peerId: string, pairingCode: string): boolean {
    const peer = this.peers.get(peerId);
    if (!peer) {
      return false;
    }

    const packet: SharePacket = {
      type: 'request',
      deviceId: this.deviceId,
      deviceName: this.deviceName,
      timestamp: Date.now(),
      code: pairingCode,
    };

    this.sendTo(packet, peer.address, peer.port);
    return true;
  }

  /**
   * Get list of discovered peers
   */
  getPeers(): PeerDevice[] {
    return Array.from(this.peers.values());
  }

  /**
   * Clean up stale peers
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const stale: string[] = [];

      this.peers.forEach((peer, id) => {
        if (now - peer.lastSeen > this.peerTimeoutMs) {
          stale.push(id);
        }
      });

      stale.forEach((id) => {
        const peer = this.peers.get(id);
        console.log(`[LANSharing] Peer timeout: ${peer?.name}`);
        this.peers.delete(id);
        this.emit('peer-lost', id);
      });
    }, 5000);
  }

  /**
   * Simple encryption with pairing code
   */
  private encrypt(data: string, code: string): string {
    const key = crypto.scryptSync(code, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt data with pairing code
   */
  decrypt(encrypted: string, code: string): string | null {
    try {
      const [ivHex, encryptedData] = encrypted.split(':');
      const key = crypto.scryptSync(code, 'salt', 32);
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (err) {
      console.error('[LANSharing] Decryption failed:', err);
      return null;
    }
  }

  /**
   * Get device info
   */
  getDeviceInfo() {
    return {
      id: this.deviceId,
      name: this.deviceName,
      isRunning: this.isRunning,
    };
  }

  // Active pairing code when this device is waiting to send files
  private activePairingCode: string | null = null;

  /**
   * Set active pairing code (called when preparing to send files)
   */
  setActivePairingCode(code: string | null): void {
    this.activePairingCode = code;
    console.log(`[LANSharing] Active pairing code set: ${code}`);
  }

  /**
   * Handle find-sender request from receiver
   */
  private handleFindSender(packet: SharePacket, rinfo: dgram.RemoteInfo): void {
    const requestedCode = packet.code;
    console.log(`[LANSharing] Find-sender request for code ${requestedCode} from ${packet.deviceName}`);

    // Check if we are waiting with this code
    if (this.activePairingCode && this.activePairingCode === requestedCode) {
      console.log(`[LANSharing] Match! Responding with sender info`);
      
      const response: SharePacket = {
        type: 'sender-found',
        deviceId: this.deviceId,
        deviceName: this.deviceName,
        timestamp: Date.now(),
        code: requestedCode,
        data: {
          address: this.getLocalIPAddress(),
          port: 45679 // FILE_TRANSFER_PORT
        }
      };

      this.sendTo(response, rinfo.address, rinfo.port);
    }
  }

  /**
   * Handle sender-found response
   */
  private handleSenderFound(packet: SharePacket, rinfo: dgram.RemoteInfo): void {
    console.log(`[LANSharing] Sender found: ${packet.deviceName} at ${packet.data.address}:${packet.data.port}`);
    
    this.emit('sender-found', {
      deviceId: packet.deviceId,
      deviceName: packet.deviceName,
      address: packet.data.address,
      port: packet.data.port,
      code: packet.code
    });
  }

  /**
   * Broadcast to find sender with specific pairing code
   */
  findSenderByCode(pairingCode: string): void {
    console.log(`[LANSharing] Broadcasting find-sender for code ${pairingCode}`);
    
    const packet: SharePacket = {
      type: 'find-sender',
      deviceId: this.deviceId,
      deviceName: this.deviceName,
      timestamp: Date.now(),
      code: pairingCode
    };

    this.broadcast(packet);
  }

  /**
   * Get local IP address
   */
  private getLocalIPAddress(): string {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      const netInterface = interfaces[name];
      if (!netInterface) continue;
      
      for (const net of netInterface) {
        if (!net.internal && net.family === 'IPv4') {
          return net.address;
        }
      }
    }
    return '127.0.0.1';
  }
}
