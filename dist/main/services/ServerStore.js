"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServerStore = void 0;
const electron_store_1 = __importDefault(require("electron-store"));
class ServerStore {
    constructor() {
        this.store = new electron_store_1.default({
            defaults: {
                servers: [],
                tagColors: {},
            },
        });
    }
    getAllServers() {
        return this.store.get('servers', []);
    }
    getServer(id) {
        const servers = this.getAllServers();
        return servers.find(server => server.id === id);
    }
    addServer(server) {
        const servers = this.getAllServers();
        const newServer = {
            ...server,
            id: Date.now().toString(),
            createdAt: Date.now(),
        };
        servers.push(newServer);
        this.store.set('servers', servers);
        return newServer;
    }
    updateServer(id, updates) {
        const servers = this.getAllServers();
        const index = servers.findIndex(server => server.id === id);
        if (index === -1) {
            return false;
        }
        servers[index] = { ...servers[index], ...updates };
        this.store.set('servers', servers);
        return true;
    }
    deleteServer(id) {
        const servers = this.getAllServers();
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
        const servers = this.getAllServers();
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
    // Set all servers (for backup restore)
    setServers(servers) {
        this.store.set('servers', servers);
    }
    // Set all tag colors (for backup restore)
    setTagColors(tagColors) {
        this.store.set('tagColors', tagColors);
    }
}
exports.ServerStore = ServerStore;
//# sourceMappingURL=ServerStore.js.map