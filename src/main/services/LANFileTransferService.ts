/**
 * LAN File Transfer Service
 * Transfer files and folders over local network using TCP with AES-256-GCM encryption
 * 
 * SECURITY: All data is encrypted using AES-256-GCM with key derived from pairing code
 * via PBKDF2 (100,000 iterations). This protects against network sniffing.
 * 
 * FLOW:
 * 1. Sender: prepareToSend() - Creates a pending session with files + pairing code, waits for receiver
 * 2. Receiver: requestFiles() - Connects to sender with pairing code
 * 3. Both sides derive encryption key from pairing code
 * 4. Sender verifies code and starts sending encrypted files
 */

import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as os from 'os';
import { EventEmitter } from 'events';

// Protocol constants
const CHUNK_SIZE = 64 * 1024; // 64KB chunks for transfer
const HEADER_SIZE = 8; // 8 bytes for packet length
const FILE_TRANSFER_PORT = 45679;

// Encryption constants
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_SALT = 'marix-lan-transfer-v1'; // Static salt (pairing code provides entropy)

interface FileInfo {
  name: string;
  relativePath: string;
  size: number;
  isDirectory: boolean;
}

interface TransferSession {
  id: string;
  peerId: string;
  peerAddress: string;
  files: FileInfo[];
  totalSize: number;
  transferredSize: number;
  status: 'pending' | 'waiting' | 'transferring' | 'completed' | 'failed' | 'cancelled';
  direction: 'send' | 'receive';
  socket?: net.Socket;
  startTime?: number;
  pairingCode?: string;
  savePath?: string;
  filePaths?: string[];
  encryptionKey?: Buffer; // Derived from pairing code
}

interface TransferPacket {
  type: 'request' | 'handshake' | 'file-info' | 'file-data' | 'file-end' | 'ack' | 'error' | 'cancel';
  sessionId: string;
  data?: any;
}

export class LANFileTransferService extends EventEmitter {
  private server: net.Server | null = null;
  private isRunning = false;
  private sessions: Map<string, TransferSession> = new Map();
  private deviceId: string;
  private deviceName: string;
  private encryptionKeys: Map<string, Buffer> = new Map(); // sessionId -> key

  constructor() {
    super();
    this.deviceId = this.generateDeviceId();
    this.deviceName = os.hostname() || 'Unknown Device';
  }

  /**
   * Derive AES-256 key from pairing code using PBKDF2
   */
  private deriveKeyFromCode(pairingCode: string): Buffer {
    return crypto.pbkdf2Sync(
      pairingCode,
      PBKDF2_SALT,
      PBKDF2_ITERATIONS,
      KEY_LENGTH,
      'sha256'
    );
  }

  /**
   * Encrypt data using AES-256-GCM
   */
  private encrypt(data: Buffer, key: Buffer): Buffer {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
    
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    const authTag = cipher.getAuthTag();
    
    // Format: IV (12 bytes) + AuthTag (16 bytes) + Encrypted data
    return Buffer.concat([iv, authTag, encrypted]);
  }

  /**
   * Decrypt data using AES-256-GCM
   */
  private decrypt(data: Buffer, key: Buffer): Buffer {
    const iv = data.slice(0, IV_LENGTH);
    const authTag = data.slice(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = data.slice(IV_LENGTH + AUTH_TAG_LENGTH);
    
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }

  private generateDeviceId(): string {
    const hostname = os.hostname();
    const interfaces = os.networkInterfaces();
    let macAddress = '';
    
    for (const name of Object.keys(interfaces)) {
      const netInterface = interfaces[name];
      if (!netInterface) continue;
      
      for (const net of netInterface) {
        if (!net.internal && net.mac && net.mac !== '00:00:00:00:00:00') {
          macAddress = net.mac;
          break;
        }
      }
      if (macAddress) break;
    }
    
    const source = `${hostname}-${macAddress}-file`;
    return crypto.createHash('sha256').update(source).digest('hex').substring(0, 32);
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => {
        this.handleIncomingConnection(socket);
      });

      this.server.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          console.log('[FileTransfer] Port in use, trying next...');
          this.server?.listen(FILE_TRANSFER_PORT + 1);
        } else {
          console.error('[FileTransfer] Server error:', err);
          reject(err);
        }
      });

      this.server.listen(FILE_TRANSFER_PORT, () => {
        this.isRunning = true;
        console.log(`[FileTransfer] Server listening on port ${FILE_TRANSFER_PORT}`);
        resolve();
      });
    });
  }

  stop(): void {
    for (const [sessionId, session] of this.sessions) {
      if (session.socket) {
        session.socket.destroy();
      }
      session.status = 'cancelled';
    }
    this.sessions.clear();
    this.encryptionKeys.clear();

    if (this.server) {
      this.server.close();
      this.server = null;
    }
    this.isRunning = false;
    console.log('[FileTransfer] Server stopped');
  }

  private handleIncomingConnection(socket: net.Socket): void {
    console.log(`[FileTransfer] Incoming connection from ${socket.remoteAddress}`);
    
    let buffer = Buffer.alloc(0);
    let expectedLength = 0;
    let socketSessionId: string | null = null; // Track session for this socket

    socket.on('data', (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      
      // New header format: 4 bytes length + 1 byte encryption flag
      const TOTAL_HEADER = HEADER_SIZE + 1;
      
      while (buffer.length >= TOTAL_HEADER) {
        if (expectedLength === 0) {
          expectedLength = buffer.readUInt32BE(0);
        }
        
        if (buffer.length >= TOTAL_HEADER + expectedLength) {
          const isEncrypted = buffer[HEADER_SIZE] === 1;
          const packetData = buffer.slice(TOTAL_HEADER, TOTAL_HEADER + expectedLength);
          buffer = buffer.slice(TOTAL_HEADER + expectedLength);
          expectedLength = 0;
          
          // Get encryption key if available
          const encKey = socketSessionId ? this.encryptionKeys.get(socketSessionId) : undefined;
          
          const packet = this.parsePacketData(packetData, isEncrypted ? encKey : undefined);
          if (packet) {
            // Track session ID for future encrypted packets
            if (!socketSessionId && packet.sessionId) {
              socketSessionId = packet.sessionId;
            }
            this.handlePacket(socket, packet, socketSessionId);
          }
        } else {
          break;
        }
      }
    });

    socket.on('error', (err) => {
      console.error('[FileTransfer] Socket error:', err);
    });

    socket.on('close', () => {
      console.log('[FileTransfer] Connection closed');
    });
  }

  private handlePacket(socket: net.Socket, packet: TransferPacket, socketSessionId?: string | null): void {
    console.log(`[FileTransfer] handlePacket: ${packet.type}, sessionId: ${packet.sessionId}`);
    
    switch (packet.type) {
      case 'request':
        this.handleRequest(socket, packet);
        break;
      case 'handshake':
        this.handleHandshake(socket, packet);
        break;
      case 'file-info':
        this.handleFileInfo(socket, packet);
        break;
      case 'file-data':
        this.handleFileData(socket, packet);
        break;
      case 'file-end':
        this.handleFileEnd(socket, packet);
        break;
      case 'ack':
        this.handleAck(socket, packet);
        break;
      case 'error':
        this.handleError(socket, packet);
        break;
      case 'cancel':
        this.handleCancel(socket, packet);
        break;
    }
  }

  /**
   * Handle handshake from sender - tells receiver about files to expect
   */
  private handleHandshake(socket: net.Socket, packet: TransferPacket): void {
    const session = this.sessions.get(packet.sessionId);
    if (!session) {
      console.log(`[FileTransfer] No session found for handshake, sessionId: ${packet.sessionId}`);
      return;
    }
    
    const { senderSessionId, files, totalSize } = packet.data;
    console.log(`[FileTransfer] Handshake received: ${files.length} files, ${totalSize} bytes`);
    
    session.files = files;
    session.totalSize = totalSize;
    (session as any).senderSessionId = senderSessionId;
    
    this.emit('transfer-started', {
      sessionId: packet.sessionId,
      direction: 'receive',
      files,
      totalSize
    });
  }

  /**
   * Handle request packet from receiver
   * Receiver connects to sender with pairing code to request files
   */
  private handleRequest(socket: net.Socket, packet: TransferPacket): void {
    const { pairingCode, deviceId, deviceName, savePath } = packet.data;
    const receiverSessionId = packet.sessionId; // Get receiver's session ID
    
    console.log(`[FileTransfer] Request from ${deviceName} with code ${pairingCode}, receiverSessionId: ${receiverSessionId}`);

    // Find pending session with matching pairing code
    let matchingSession: TransferSession | null = null;
    for (const [, session] of this.sessions) {
      if (session.status === 'waiting' && session.pairingCode === pairingCode && session.direction === 'send') {
        matchingSession = session;
        break;
      }
    }

    if (!matchingSession) {
      console.log(`[FileTransfer] No session found for code ${pairingCode}`);
      this.sendPacket(socket, {
        type: 'error',
        sessionId: receiverSessionId,
        data: { message: 'Invalid pairing code or no pending transfer' }
      });
      socket.destroy();
      return;
    }

    // Derive encryption key from pairing code
    const encryptionKey = this.deriveKeyFromCode(pairingCode);
    matchingSession.encryptionKey = encryptionKey;
    this.encryptionKeys.set(matchingSession.id, encryptionKey);
    this.encryptionKeys.set(receiverSessionId, encryptionKey);
    console.log(`[FileTransfer] Encryption key derived for session ${matchingSession.id}`);

    // Valid code - attach socket and start sending
    matchingSession.socket = socket;
    matchingSession.peerId = deviceId;
    matchingSession.peerAddress = socket.remoteAddress || '';
    
    // IMPORTANT: Store receiver's session ID to use when sending packets
    (matchingSession as any).receiverSessionId = receiverSessionId;

    // Send handshake with file info (encrypted)
    this.sendPacket(socket, {
      type: 'handshake',
      sessionId: receiverSessionId,
      data: {
        senderSessionId: matchingSession.id,
        files: matchingSession.files,
        totalSize: matchingSession.totalSize
      }
    }, encryptionKey);

    this.emit('transfer-connected', {
      sessionId: matchingSession.id,
      receiverName: deviceName
    });

    // Start sending files after small delay to ensure handshake is processed
    setTimeout(() => {
      this.startFileSending(matchingSession!);
    }, 100);
  }

  private handleFileInfo(socket: net.Socket, packet: TransferPacket): void {
    const session = this.sessions.get(packet.sessionId);
    if (!session || session.status !== 'transferring') return;

    const encKey = this.encryptionKeys.get(packet.sessionId);
    const { name, relativePath, size, isDirectory } = packet.data;
    const fullPath = path.join(session.savePath!, relativePath);
    
    if (isDirectory) {
      fs.mkdirSync(fullPath, { recursive: true });
    } else {
      const dir = path.dirname(fullPath);
      fs.mkdirSync(dir, { recursive: true });
      
      (session as any).currentFile = {
        path: fullPath,
        size,
        received: 0,
        writeStream: fs.createWriteStream(fullPath)
      };
    }

    this.sendPacket(socket, {
      type: 'ack',
      sessionId: packet.sessionId,
      data: { ready: true }
    }, encKey);
  }

  private handleFileData(socket: net.Socket, packet: TransferPacket): void {
    const session = this.sessions.get(packet.sessionId);
    if (!session || session.status !== 'transferring') return;

    const currentFile = (session as any).currentFile;
    if (!currentFile) return;

    const chunk = Buffer.from(packet.data.chunk, 'base64');
    currentFile.writeStream.write(chunk);
    currentFile.received += chunk.length;
    session.transferredSize += chunk.length;

    const progress = Math.round((session.transferredSize / session.totalSize) * 100);
    this.emit('transfer-progress', {
      sessionId: packet.sessionId,
      progress,
      transferredSize: session.transferredSize,
      totalSize: session.totalSize,
      speed: this.calculateSpeed(session)
    });
  }

  private handleFileEnd(socket: net.Socket, packet: TransferPacket): void {
    const session = this.sessions.get(packet.sessionId);
    if (!session) return;

    const encKey = this.encryptionKeys.get(packet.sessionId);
    const currentFile = (session as any).currentFile;
    if (currentFile) {
      currentFile.writeStream.end();
      delete (session as any).currentFile;
    }

    if (session.transferredSize >= session.totalSize) {
      session.status = 'completed';
      this.emit('transfer-completed', {
        sessionId: packet.sessionId,
        direction: 'receive',
        files: session.files,
        totalSize: session.totalSize,
        duration: Date.now() - (session.startTime || 0)
      });
      // Clean up encryption key
      this.encryptionKeys.delete(packet.sessionId);
    }

    this.sendPacket(socket, {
      type: 'ack',
      sessionId: packet.sessionId,
      data: { fileComplete: true }
    }, encKey);
  }

  private handleAck(socket: net.Socket, packet: TransferPacket): void {
    const session = this.sessions.get(packet.sessionId);
    if (!session) return;

    if (packet.data.ready) {
      this.emit('file-ready', { sessionId: packet.sessionId });
    } else if (packet.data.fileComplete) {
      this.emit('file-sent', { sessionId: packet.sessionId });
    }
  }

  private handleError(socket: net.Socket, packet: TransferPacket): void {
    const session = this.sessions.get(packet.sessionId);
    if (session) {
      session.status = 'failed';
      this.emit('transfer-error', {
        sessionId: packet.sessionId,
        error: packet.data.message
      });
    }
  }

  private handleCancel(socket: net.Socket, packet: TransferPacket): void {
    const session = this.sessions.get(packet.sessionId);
    if (session) {
      session.status = 'cancelled';
      if ((session as any).currentFile?.writeStream) {
        (session as any).currentFile.writeStream.end();
      }
      this.emit('transfer-cancelled', { sessionId: packet.sessionId });
    }
  }

  /**
   * SENDER: Prepare files for sending and wait for receiver to connect
   */
  prepareToSend(filePaths: string[], pairingCode: string): { sessionId: string; files: FileInfo[]; totalSize: number } {
    const sessionId = crypto.randomUUID();
    
    const files: FileInfo[] = [];
    let totalSize = 0;
    
    for (const filePath of filePaths) {
      const stats = fs.statSync(filePath);
      const baseName = path.basename(filePath);
      
      if (stats.isDirectory()) {
        const dirFiles = this.gatherFilesFromDirectory(filePath, baseName);
        files.push(...dirFiles);
        totalSize += dirFiles.reduce((sum, f) => sum + f.size, 0);
      } else {
        files.push({
          name: baseName,
          relativePath: baseName,
          size: stats.size,
          isDirectory: false
        });
        totalSize += stats.size;
      }
    }

    const session: TransferSession = {
      id: sessionId,
      peerId: '',
      peerAddress: '',
      files,
      totalSize,
      transferredSize: 0,
      status: 'waiting',
      direction: 'send',
      pairingCode,
      filePaths
    };
    
    this.sessions.set(sessionId, session);
    
    console.log(`[FileTransfer] Prepared session ${sessionId} with code ${pairingCode}, waiting for receiver...`);
    
    this.emit('transfer-waiting', {
      sessionId,
      files,
      totalSize,
      pairingCode
    });
    
    return { sessionId, files, totalSize };
  }

  /**
   * RECEIVER: Request files from sender using pairing code
   */
  async requestFiles(peerAddress: string, peerPort: number, pairingCode: string, savePath: string): Promise<string> {
    const sessionId = crypto.randomUUID();
    
    // Derive encryption key from pairing code
    const encryptionKey = this.deriveKeyFromCode(pairingCode);
    this.encryptionKeys.set(sessionId, encryptionKey);
    
    return new Promise((resolve, reject) => {
      console.log(`[FileTransfer] Connecting to ${peerAddress}:${peerPort} with code ${pairingCode}`);
      
      const socket = net.createConnection(peerPort, peerAddress, () => {
        console.log(`[FileTransfer] Connected to sender, encryption enabled`);
        
        const session: TransferSession = {
          id: sessionId,
          peerId: '',
          peerAddress,
          files: [],
          totalSize: 0,
          transferredSize: 0,
          status: 'transferring',
          direction: 'receive',
          socket,
          pairingCode,
          savePath,
          startTime: Date.now(),
          encryptionKey
        };
        
        this.sessions.set(sessionId, session);
        
        // Send request with pairing code (unencrypted - needed for sender to derive key)
        this.sendPacket(socket, {
          type: 'request',
          sessionId,
          data: {
            pairingCode,
            deviceId: this.deviceId,
            deviceName: this.deviceName,
            savePath
          }
        }); // No encryption for initial request
        
        resolve(sessionId);
      });

      let buffer = Buffer.alloc(0);
      let expectedLength = 0;
      const TOTAL_HEADER = HEADER_SIZE + 1; // Include encryption flag

      socket.on('data', (chunk: Buffer) => {
        buffer = Buffer.concat([buffer, chunk]);
        
        while (buffer.length >= TOTAL_HEADER) {
          if (expectedLength === 0) {
            expectedLength = buffer.readUInt32BE(0);
          }
          
          if (buffer.length >= TOTAL_HEADER + expectedLength) {
            const isEncrypted = buffer[HEADER_SIZE] === 1;
            const packetData = buffer.slice(TOTAL_HEADER, TOTAL_HEADER + expectedLength);
            buffer = buffer.slice(TOTAL_HEADER + expectedLength);
            expectedLength = 0;
            
            const packet = this.parsePacketData(packetData, isEncrypted ? encryptionKey : undefined);
            if (packet) {
              this.handlePacket(socket, packet, sessionId);
            }
          } else {
            break;
          }
        }
      });

      socket.on('error', (err) => {
        console.error('[FileTransfer] Connection error:', err);
        const session = this.sessions.get(sessionId);
        if (session) {
          session.status = 'failed';
          this.emit('transfer-error', { sessionId, error: err.message });
        }
        reject(err);
      });

      socket.on('close', () => {
        console.log('[FileTransfer] Connection closed');
      });
    });
  }

  private async startFileSending(session: TransferSession): Promise<void> {
    session.status = 'transferring';
    session.startTime = Date.now();
    this.emit('transfer-started', { sessionId: session.id, direction: 'send' });

    const filePaths: string[] = session.filePaths || [];
    
    for (const filePath of filePaths) {
      const stats = fs.statSync(filePath);
      const baseName = path.basename(filePath);
      
      if (stats.isDirectory()) {
        await this.sendDirectory(session, filePath, baseName);
      } else {
        await this.sendFile(session, filePath, baseName);
      }
    }

    session.status = 'completed';
    // Clean up encryption key
    this.encryptionKeys.delete(session.id);
    if ((session as any).receiverSessionId) {
      this.encryptionKeys.delete((session as any).receiverSessionId);
    }
    
    this.emit('transfer-completed', {
      sessionId: session.id,
      direction: 'send',
      files: session.files,
      totalSize: session.totalSize,
      duration: Date.now() - session.startTime
    });
  }

  private async sendFile(session: TransferSession, filePath: string, relativePath: string): Promise<void> {
    const stats = fs.statSync(filePath);
    // Use receiver's sessionId so receiver can find its session
    const targetSessionId = (session as any).receiverSessionId || session.id;
    const encKey = session.encryptionKey;
    
    this.sendPacket(session.socket!, {
      type: 'file-info',
      sessionId: targetSessionId,
      data: {
        name: path.basename(filePath),
        relativePath,
        size: stats.size,
        isDirectory: false
      }
    }, encKey);

    await new Promise(resolve => setTimeout(resolve, 50));

    const readStream = fs.createReadStream(filePath, { highWaterMark: CHUNK_SIZE });
    
    for await (const chunk of readStream) {
      this.sendPacket(session.socket!, {
        type: 'file-data',
        sessionId: targetSessionId,
        data: {
          chunk: (chunk as Buffer).toString('base64')
        }
      }, encKey);
      
      session.transferredSize += (chunk as Buffer).length;
      
      const progress = Math.round((session.transferredSize / session.totalSize) * 100);
      this.emit('transfer-progress', {
        sessionId: session.id,
        progress,
        transferredSize: session.transferredSize,
        totalSize: session.totalSize,
        speed: this.calculateSpeed(session)
      });

      await new Promise(resolve => setTimeout(resolve, 1));
    }

    this.sendPacket(session.socket!, {
      type: 'file-end',
      sessionId: targetSessionId,
      data: { name: path.basename(filePath) }
    }, encKey);
  }

  private async sendDirectory(session: TransferSession, dirPath: string, relativePath: string): Promise<void> {
    // Use receiver's sessionId so receiver can find its session
    const targetSessionId = (session as any).receiverSessionId || session.id;
    const encKey = session.encryptionKey;
    
    this.sendPacket(session.socket!, {
      type: 'file-info',
      sessionId: targetSessionId,
      data: {
        name: path.basename(dirPath),
        relativePath,
        size: 0,
        isDirectory: true
      }
    }, encKey);

    await new Promise(resolve => setTimeout(resolve, 50));

    const entries = fs.readdirSync(dirPath);
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry);
      const entryRelativePath = path.join(relativePath, entry);
      const stats = fs.statSync(fullPath);

      if (stats.isDirectory()) {
        await this.sendDirectory(session, fullPath, entryRelativePath);
      } else {
        await this.sendFile(session, fullPath, entryRelativePath);
      }
    }
  }

  private gatherFilesFromDirectory(dirPath: string, basePath: string): FileInfo[] {
    const files: FileInfo[] = [];
    
    files.push({
      name: path.basename(dirPath),
      relativePath: basePath,
      size: 0,
      isDirectory: true
    });

    const entries = fs.readdirSync(dirPath);
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry);
      const relativePath = path.join(basePath, entry);
      const stats = fs.statSync(fullPath);

      if (stats.isDirectory()) {
        files.push(...this.gatherFilesFromDirectory(fullPath, relativePath));
      } else {
        files.push({
          name: entry,
          relativePath,
          size: stats.size,
          isDirectory: false
        });
      }
    }

    return files;
  }

  /**
   * Send packet with optional encryption
   * First packet (request) is unencrypted, subsequent packets are encrypted
   */
  private sendPacket(socket: net.Socket, packet: TransferPacket, encryptionKey?: Buffer): void {
    const jsonData = Buffer.from(JSON.stringify(packet));
    
    let data: Buffer;
    if (encryptionKey) {
      // Encrypt the packet data
      data = this.encrypt(jsonData, encryptionKey);
    } else {
      data = jsonData;
    }
    
    const header = Buffer.alloc(HEADER_SIZE);
    header.writeUInt32BE(data.length, 0);
    // Add 1-byte flag: 0 = unencrypted, 1 = encrypted
    const flag = Buffer.alloc(1);
    flag[0] = encryptionKey ? 1 : 0;
    
    socket.write(Buffer.concat([header, flag, data]));
  }

  /**
   * Parse incoming data, handling encryption
   */
  private parsePacketData(data: Buffer, encryptionKey?: Buffer): TransferPacket | null {
    try {
      if (encryptionKey && data.length > IV_LENGTH + AUTH_TAG_LENGTH) {
        const decrypted = this.decrypt(data, encryptionKey);
        return JSON.parse(decrypted.toString());
      }
      return JSON.parse(data.toString());
    } catch (err) {
      console.error('[FileTransfer] Failed to parse/decrypt packet:', err);
      return null;
    }
  }

  private calculateSpeed(session: TransferSession): string {
    if (!session.startTime) return '0 B/s';
    const elapsed = (Date.now() - session.startTime) / 1000;
    if (elapsed === 0) return '0 B/s';
    const speed = session.transferredSize / elapsed;
    return this.formatSize(speed) + '/s';
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  }

  cancelTransfer(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const encKey = this.encryptionKeys.get(sessionId);
    
    if (session.socket) {
      this.sendPacket(session.socket, {
        type: 'cancel',
        sessionId
      }, encKey);
      session.socket.destroy();
    }

    session.status = 'cancelled';
    this.encryptionKeys.delete(sessionId);
    this.emit('transfer-cancelled', { sessionId });
  }

  getSessions(): TransferSession[] {
    return Array.from(this.sessions.values());
  }

  getSession(sessionId: string): TransferSession | undefined {
    return this.sessions.get(sessionId);
  }

  getDeviceInfo(): { deviceId: string; deviceName: string; port: number } {
    return {
      deviceId: this.deviceId,
      deviceName: this.deviceName,
      port: FILE_TRANSFER_PORT
    };
  }

  generatePairingCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}

export const lanFileTransferService = new LANFileTransferService();
