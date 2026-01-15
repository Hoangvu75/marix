"use strict";
/**
 * LAN File Transfer Service
 * Transfer files and folders over local network using TCP
 *
 * NEW FLOW:
 * 1. Sender: prepareToSend() - Creates a pending session with files + pairing code, waits for receiver
 * 2. Receiver: requestFiles() - Connects to sender with pairing code
 * 3. Sender verifies code and starts sending files
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
exports.lanFileTransferService = exports.LANFileTransferService = void 0;
const net = __importStar(require("net"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
const os = __importStar(require("os"));
const events_1 = require("events");
// Protocol constants
const CHUNK_SIZE = 64 * 1024; // 64KB chunks for transfer
const HEADER_SIZE = 8; // 8 bytes for packet length
const FILE_TRANSFER_PORT = 45679;
class LANFileTransferService extends events_1.EventEmitter {
    constructor() {
        super();
        this.server = null;
        this.isRunning = false;
        this.sessions = new Map();
        this.deviceId = this.generateDeviceId();
        this.deviceName = os.hostname() || 'Unknown Device';
    }
    generateDeviceId() {
        const hostname = os.hostname();
        const interfaces = os.networkInterfaces();
        let macAddress = '';
        for (const name of Object.keys(interfaces)) {
            const netInterface = interfaces[name];
            if (!netInterface)
                continue;
            for (const net of netInterface) {
                if (!net.internal && net.mac && net.mac !== '00:00:00:00:00:00') {
                    macAddress = net.mac;
                    break;
                }
            }
            if (macAddress)
                break;
        }
        const source = `${hostname}-${macAddress}-file`;
        return crypto.createHash('sha256').update(source).digest('hex').substring(0, 32);
    }
    async start() {
        if (this.isRunning)
            return;
        return new Promise((resolve, reject) => {
            this.server = net.createServer((socket) => {
                this.handleIncomingConnection(socket);
            });
            this.server.on('error', (err) => {
                if (err.code === 'EADDRINUSE') {
                    console.log('[FileTransfer] Port in use, trying next...');
                    this.server?.listen(FILE_TRANSFER_PORT + 1);
                }
                else {
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
    stop() {
        for (const [sessionId, session] of this.sessions) {
            if (session.socket) {
                session.socket.destroy();
            }
            session.status = 'cancelled';
        }
        this.sessions.clear();
        if (this.server) {
            this.server.close();
            this.server = null;
        }
        this.isRunning = false;
        console.log('[FileTransfer] Server stopped');
    }
    handleIncomingConnection(socket) {
        console.log(`[FileTransfer] Incoming connection from ${socket.remoteAddress}`);
        let buffer = Buffer.alloc(0);
        let expectedLength = 0;
        socket.on('data', (chunk) => {
            buffer = Buffer.concat([buffer, chunk]);
            while (buffer.length >= HEADER_SIZE) {
                if (expectedLength === 0) {
                    expectedLength = buffer.readUInt32BE(0);
                }
                if (buffer.length >= HEADER_SIZE + expectedLength) {
                    const packetData = buffer.slice(HEADER_SIZE, HEADER_SIZE + expectedLength);
                    buffer = buffer.slice(HEADER_SIZE + expectedLength);
                    expectedLength = 0;
                    try {
                        const packet = JSON.parse(packetData.toString());
                        this.handlePacket(socket, packet);
                    }
                    catch (err) {
                        console.error('[FileTransfer] Failed to parse packet:', err);
                    }
                }
                else {
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
    handlePacket(socket, packet) {
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
    handleHandshake(socket, packet) {
        const session = this.sessions.get(packet.sessionId);
        if (!session) {
            console.log(`[FileTransfer] No session found for handshake, sessionId: ${packet.sessionId}`);
            return;
        }
        const { senderSessionId, files, totalSize } = packet.data;
        console.log(`[FileTransfer] Handshake received: ${files.length} files, ${totalSize} bytes`);
        session.files = files;
        session.totalSize = totalSize;
        session.senderSessionId = senderSessionId;
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
    handleRequest(socket, packet) {
        const { pairingCode, deviceId, deviceName, savePath } = packet.data;
        const receiverSessionId = packet.sessionId; // Get receiver's session ID
        console.log(`[FileTransfer] Request from ${deviceName} with code ${pairingCode}, receiverSessionId: ${receiverSessionId}`);
        // Find pending session with matching pairing code
        let matchingSession = null;
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
        // Valid code - attach socket and start sending
        matchingSession.socket = socket;
        matchingSession.peerId = deviceId;
        matchingSession.peerAddress = socket.remoteAddress || '';
        // IMPORTANT: Store receiver's session ID to use when sending packets
        matchingSession.receiverSessionId = receiverSessionId;
        // Send handshake with file info first so receiver knows what to expect
        this.sendPacket(socket, {
            type: 'handshake',
            sessionId: receiverSessionId,
            data: {
                senderSessionId: matchingSession.id,
                files: matchingSession.files,
                totalSize: matchingSession.totalSize
            }
        });
        this.emit('transfer-connected', {
            sessionId: matchingSession.id,
            receiverName: deviceName
        });
        // Start sending files after small delay to ensure handshake is processed
        setTimeout(() => {
            this.startFileSending(matchingSession);
        }, 100);
    }
    handleFileInfo(socket, packet) {
        const session = this.sessions.get(packet.sessionId);
        if (!session || session.status !== 'transferring')
            return;
        const { name, relativePath, size, isDirectory } = packet.data;
        const fullPath = path.join(session.savePath, relativePath);
        if (isDirectory) {
            fs.mkdirSync(fullPath, { recursive: true });
        }
        else {
            const dir = path.dirname(fullPath);
            fs.mkdirSync(dir, { recursive: true });
            session.currentFile = {
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
        });
    }
    handleFileData(socket, packet) {
        const session = this.sessions.get(packet.sessionId);
        if (!session || session.status !== 'transferring')
            return;
        const currentFile = session.currentFile;
        if (!currentFile)
            return;
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
    handleFileEnd(socket, packet) {
        const session = this.sessions.get(packet.sessionId);
        if (!session)
            return;
        const currentFile = session.currentFile;
        if (currentFile) {
            currentFile.writeStream.end();
            delete session.currentFile;
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
        }
        this.sendPacket(socket, {
            type: 'ack',
            sessionId: packet.sessionId,
            data: { fileComplete: true }
        });
    }
    handleAck(socket, packet) {
        const session = this.sessions.get(packet.sessionId);
        if (!session)
            return;
        if (packet.data.ready) {
            this.emit('file-ready', { sessionId: packet.sessionId });
        }
        else if (packet.data.fileComplete) {
            this.emit('file-sent', { sessionId: packet.sessionId });
        }
    }
    handleError(socket, packet) {
        const session = this.sessions.get(packet.sessionId);
        if (session) {
            session.status = 'failed';
            this.emit('transfer-error', {
                sessionId: packet.sessionId,
                error: packet.data.message
            });
        }
    }
    handleCancel(socket, packet) {
        const session = this.sessions.get(packet.sessionId);
        if (session) {
            session.status = 'cancelled';
            if (session.currentFile?.writeStream) {
                session.currentFile.writeStream.end();
            }
            this.emit('transfer-cancelled', { sessionId: packet.sessionId });
        }
    }
    /**
     * SENDER: Prepare files for sending and wait for receiver to connect
     */
    prepareToSend(filePaths, pairingCode) {
        const sessionId = crypto.randomUUID();
        const files = [];
        let totalSize = 0;
        for (const filePath of filePaths) {
            const stats = fs.statSync(filePath);
            const baseName = path.basename(filePath);
            if (stats.isDirectory()) {
                const dirFiles = this.gatherFilesFromDirectory(filePath, baseName);
                files.push(...dirFiles);
                totalSize += dirFiles.reduce((sum, f) => sum + f.size, 0);
            }
            else {
                files.push({
                    name: baseName,
                    relativePath: baseName,
                    size: stats.size,
                    isDirectory: false
                });
                totalSize += stats.size;
            }
        }
        const session = {
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
    async requestFiles(peerAddress, peerPort, pairingCode, savePath) {
        const sessionId = crypto.randomUUID();
        return new Promise((resolve, reject) => {
            console.log(`[FileTransfer] Connecting to ${peerAddress}:${peerPort} with code ${pairingCode}`);
            const socket = net.createConnection(peerPort, peerAddress, () => {
                console.log(`[FileTransfer] Connected to sender`);
                const session = {
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
                    startTime: Date.now()
                };
                this.sessions.set(sessionId, session);
                // Send request with pairing code
                this.sendPacket(socket, {
                    type: 'request',
                    sessionId,
                    data: {
                        pairingCode,
                        deviceId: this.deviceId,
                        deviceName: this.deviceName,
                        savePath
                    }
                });
                resolve(sessionId);
            });
            let buffer = Buffer.alloc(0);
            let expectedLength = 0;
            socket.on('data', (chunk) => {
                buffer = Buffer.concat([buffer, chunk]);
                while (buffer.length >= HEADER_SIZE) {
                    if (expectedLength === 0) {
                        expectedLength = buffer.readUInt32BE(0);
                    }
                    if (buffer.length >= HEADER_SIZE + expectedLength) {
                        const packetData = buffer.slice(HEADER_SIZE, HEADER_SIZE + expectedLength);
                        buffer = buffer.slice(HEADER_SIZE + expectedLength);
                        expectedLength = 0;
                        try {
                            const packet = JSON.parse(packetData.toString());
                            this.handlePacket(socket, packet);
                        }
                        catch (err) {
                            console.error('[FileTransfer] Failed to parse packet:', err);
                        }
                    }
                    else {
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
    async startFileSending(session) {
        session.status = 'transferring';
        session.startTime = Date.now();
        this.emit('transfer-started', { sessionId: session.id, direction: 'send' });
        const filePaths = session.filePaths || [];
        for (const filePath of filePaths) {
            const stats = fs.statSync(filePath);
            const baseName = path.basename(filePath);
            if (stats.isDirectory()) {
                await this.sendDirectory(session, filePath, baseName);
            }
            else {
                await this.sendFile(session, filePath, baseName);
            }
        }
        session.status = 'completed';
        this.emit('transfer-completed', {
            sessionId: session.id,
            direction: 'send',
            files: session.files,
            totalSize: session.totalSize,
            duration: Date.now() - session.startTime
        });
    }
    async sendFile(session, filePath, relativePath) {
        const stats = fs.statSync(filePath);
        // Use receiver's sessionId so receiver can find its session
        const targetSessionId = session.receiverSessionId || session.id;
        this.sendPacket(session.socket, {
            type: 'file-info',
            sessionId: targetSessionId,
            data: {
                name: path.basename(filePath),
                relativePath,
                size: stats.size,
                isDirectory: false
            }
        });
        await new Promise(resolve => setTimeout(resolve, 50));
        const readStream = fs.createReadStream(filePath, { highWaterMark: CHUNK_SIZE });
        for await (const chunk of readStream) {
            this.sendPacket(session.socket, {
                type: 'file-data',
                sessionId: targetSessionId,
                data: {
                    chunk: chunk.toString('base64')
                }
            });
            session.transferredSize += chunk.length;
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
        this.sendPacket(session.socket, {
            type: 'file-end',
            sessionId: targetSessionId,
            data: { name: path.basename(filePath) }
        });
    }
    async sendDirectory(session, dirPath, relativePath) {
        // Use receiver's sessionId so receiver can find its session
        const targetSessionId = session.receiverSessionId || session.id;
        this.sendPacket(session.socket, {
            type: 'file-info',
            sessionId: targetSessionId,
            data: {
                name: path.basename(dirPath),
                relativePath,
                size: 0,
                isDirectory: true
            }
        });
        await new Promise(resolve => setTimeout(resolve, 50));
        const entries = fs.readdirSync(dirPath);
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry);
            const entryRelativePath = path.join(relativePath, entry);
            const stats = fs.statSync(fullPath);
            if (stats.isDirectory()) {
                await this.sendDirectory(session, fullPath, entryRelativePath);
            }
            else {
                await this.sendFile(session, fullPath, entryRelativePath);
            }
        }
    }
    gatherFilesFromDirectory(dirPath, basePath) {
        const files = [];
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
            }
            else {
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
    sendPacket(socket, packet) {
        const data = Buffer.from(JSON.stringify(packet));
        const header = Buffer.alloc(HEADER_SIZE);
        header.writeUInt32BE(data.length, 0);
        socket.write(Buffer.concat([header, data]));
    }
    calculateSpeed(session) {
        if (!session.startTime)
            return '0 B/s';
        const elapsed = (Date.now() - session.startTime) / 1000;
        if (elapsed === 0)
            return '0 B/s';
        const speed = session.transferredSize / elapsed;
        return this.formatSize(speed) + '/s';
    }
    formatSize(bytes) {
        if (bytes < 1024)
            return bytes + ' B';
        if (bytes < 1024 * 1024)
            return (bytes / 1024).toFixed(1) + ' KB';
        if (bytes < 1024 * 1024 * 1024)
            return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    }
    cancelTransfer(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return;
        if (session.socket) {
            this.sendPacket(session.socket, {
                type: 'cancel',
                sessionId
            });
            session.socket.destroy();
        }
        session.status = 'cancelled';
        this.emit('transfer-cancelled', { sessionId });
    }
    getSessions() {
        return Array.from(this.sessions.values());
    }
    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }
    getDeviceInfo() {
        return {
            deviceId: this.deviceId,
            deviceName: this.deviceName,
            port: FILE_TRANSFER_PORT
        };
    }
    generatePairingCode() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }
}
exports.LANFileTransferService = LANFileTransferService;
exports.lanFileTransferService = new LANFileTransferService();
//# sourceMappingURL=LANFileTransferService.js.map