"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServerStore = void 0;
const electron_store_1 = __importDefault(require("electron-store"));
const SecureStorage_1 = require("./SecureStorage");
// Fields that contain sensitive data and should be encrypted
const SENSITIVE_FIELDS = ['password', 'privateKey', 'passphrase'];
class ServerStore {
    constructor() {
        this.store = new electron_store_1.default({
            defaults: {
                servers: [],
                tagColors: {},
                encryptionMigrated: false,
            },
        });
        // Migrate existing plaintext passwords to encrypted on first run
        this.migrateToEncrypted();
    }
    /**
     * Migrate existing plaintext sensitive data to encrypted format
     * Only runs once per installation
     */
    migrateToEncrypted() {
        if (this.store.get('encryptionMigrated', false)) {
            return; // Already migrated
        }
        if (!SecureStorage_1.SecureStorage.isAvailable()) {
            console.warn('[ServerStore] Encryption not available, skipping migration');
            return;
        }
        console.log('[ServerStore] Migrating sensitive data to encrypted format...');
        const servers = this.store.get('servers', []);
        let migratedCount = 0;
        const migratedServers = servers.map(server => {
            let needsMigration = false;
            // Check if any sensitive field needs encryption
            for (const field of SENSITIVE_FIELDS) {
                const value = server[field];
                if (typeof value === 'string' && value && !SecureStorage_1.SecureStorage.isEncrypted(value)) {
                    needsMigration = true;
                    break;
                }
            }
            if (needsMigration) {
                migratedCount++;
                return SecureStorage_1.SecureStorage.encryptFields(server, SENSITIVE_FIELDS);
            }
            return server;
        });
        if (migratedCount > 0) {
            this.store.set('servers', migratedServers);
            console.log(`[ServerStore] Migrated ${migratedCount} server(s) to encrypted storage`);
        }
        this.store.set('encryptionMigrated', true);
    }
    /**
     * Get all servers with sensitive data decrypted for use
     */
    getAllServers() {
        const servers = this.store.get('servers', []);
        // Decrypt sensitive fields before returning
        return servers.map(server => SecureStorage_1.SecureStorage.decryptFields(server, SENSITIVE_FIELDS));
    }
    /**
     * Get raw servers without decryption (for internal use only)
     */
    getRawServers() {
        return this.store.get('servers', []);
    }
    getServer(id) {
        const servers = this.getAllServers(); // Already decrypted
        return servers.find(server => server.id === id);
    }
    addServer(server) {
        const servers = this.getRawServers(); // Get raw (encrypted) servers
        // If server already has id and createdAt (e.g., from LAN import), use them
        const newServer = {
            ...server,
            id: server.id || Date.now().toString(),
            createdAt: server.createdAt || Date.now(),
        };
        // Encrypt sensitive fields before storing
        const encryptedServer = SecureStorage_1.SecureStorage.encryptFields(newServer, SENSITIVE_FIELDS);
        servers.push(encryptedServer);
        this.store.set('servers', servers);
        // Return decrypted version
        return newServer;
    }
    updateServer(id, updates) {
        const servers = this.getRawServers(); // Get raw (encrypted) servers
        const index = servers.findIndex(server => server.id === id);
        if (index === -1) {
            return false;
        }
        // Encrypt any sensitive fields in the updates
        const encryptedUpdates = SecureStorage_1.SecureStorage.encryptFields(updates, SENSITIVE_FIELDS);
        servers[index] = { ...servers[index], ...encryptedUpdates };
        this.store.set('servers', servers);
        return true;
    }
    deleteServer(id) {
        const servers = this.getRawServers();
        const filtered = servers.filter(server => server.id !== id);
        if (filtered.length === servers.length) {
            return false;
        }
        this.store.set('servers', filtered);
        return true;
    }
    updateLastConnected(id) {
        this.updateServer(id, { lastConnected: Date.now() });
    }
    // Tag colors management
    getTagColors() {
        return this.store.get('tagColors', {});
    }
    setTagColor(tagName, color) {
        const tagColors = this.getTagColors();
        tagColors[tagName] = color;
        this.store.set('tagColors', tagColors);
    }
    deleteTagColor(tagName) {
        const tagColors = this.getTagColors();
        delete tagColors[tagName];
        this.store.set('tagColors', tagColors);
    }
    // Delete tag from all servers
    deleteTagFromAllServers(tagName) {
        const servers = this.getRawServers();
        const updatedServers = servers.map(server => {
            if (server.tags?.includes(tagName)) {
                return {
                    ...server,
                    tags: server.tags.filter(t => t !== tagName)
                };
            }
            return server;
        });
        this.store.set('servers', updatedServers);
        // Also delete the color
        this.deleteTagColor(tagName);
    }
    /**
     * Set all servers (for backup restore)
     * Input should be decrypted - will be encrypted before storing
     */
    setServers(servers) {
        // Encrypt sensitive fields before storing
        const encryptedServers = servers.map(server => SecureStorage_1.SecureStorage.encryptFields(server, SENSITIVE_FIELDS));
        this.store.set('servers', encryptedServers);
    }
    /**
     * Reorder servers - update the order in storage
     * Servers come already in the new order, we just need to save them
     */
    reorderServers(servers) {
        // Get raw servers to preserve encrypted data
        const rawServers = this.getRawServers();
        // Create a map for quick lookup
        const serverMap = new Map(rawServers.map(s => [s.id, s]));
        // Reorder based on incoming order, using raw (encrypted) data
        const reorderedServers = servers
            .map(s => serverMap.get(s.id))
            .filter((s) => s !== undefined);
        this.store.set('servers', reorderedServers);
    }
    // Set all tag colors (for backup restore)
    setTagColors(tagColors) {
        this.store.set('tagColors', tagColors);
    }
}
exports.ServerStore = ServerStore;
//# sourceMappingURL=ServerStore.js.map