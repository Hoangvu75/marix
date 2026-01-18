"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cloudflareService = exports.CloudflareService = void 0;
const cloudflare_1 = __importDefault(require("cloudflare"));
const electron_store_1 = __importDefault(require("electron-store"));
const SecureStorage_1 = require("./SecureStorage");
const store = new electron_store_1.default();
class CloudflareService {
    constructor() {
        this.client = null;
    }
    /**
     * Get stored API token (decrypted)
     */
    getToken() {
        const encrypted = store.get('cloudflare.token', null);
        if (!encrypted)
            return null;
        return SecureStorage_1.SecureStorage.decrypt(encrypted);
    }
    /**
     * Save API token (encrypted with OS keychain)
     */
    setToken(token) {
        console.log('[CloudflareService] Setting new token (encrypted)');
        const encrypted = SecureStorage_1.SecureStorage.encrypt(token);
        store.set('cloudflare.token', encrypted);
        this.client = null; // Reset client to use new token
    }
    /**
     * Remove API token
     */
    removeToken() {
        console.log('[CloudflareService] Removing token');
        store.delete('cloudflare.token');
        this.client = null;
    }
    /**
     * Check if token is configured
     */
    hasToken() {
        return !!this.getToken();
    }
    /**
     * Get Cloudflare client instance
     */
    getClient() {
        const token = this.getToken();
        console.log('[CloudflareService] getClient - token exists:', !!token);
        if (!token) {
            throw new Error('Cloudflare API token not configured');
        }
        // Always create a new client to ensure fresh token is used
        this.client = new cloudflare_1.default({
            apiToken: token,
        });
        return this.client;
    }
    /**
     * Verify API token is valid
     */
    async verifyToken() {
        try {
            const client = this.getClient();
            const result = await client.user.tokens.verify();
            return {
                success: result.status === 'active',
                email: 'Token verified'
            };
        }
        catch (error) {
            console.error('[CloudflareService] Token verification failed:', error);
            return { success: false, error: error.message || 'Invalid token' };
        }
    }
    /**
     * List all zones (domains)
     */
    async listZones() {
        try {
            const client = this.getClient();
            const zones = [];
            for await (const zone of client.zones.list()) {
                const z = zone;
                zones.push({
                    id: z.id,
                    name: z.name,
                    status: z.status || 'unknown',
                    paused: z.paused || false,
                    type: z.type || 'full',
                    development_mode: z.development_mode || 0,
                    name_servers: z.name_servers || [],
                    original_name_servers: z.original_name_servers || undefined,
                    modified_on: z.modified_on,
                    created_on: z.created_on,
                });
            }
            return { success: true, zones };
        }
        catch (error) {
            console.error('[CloudflareService] Failed to list zones:', error);
            return { success: false, error: error.message };
        }
    }
    /**
     * List DNS records for a zone
     */
    async listDNSRecords(zoneId) {
        try {
            const client = this.getClient();
            const records = [];
            for await (const record of client.dns.records.list({ zone_id: zoneId })) {
                const r = record;
                records.push({
                    id: r.id,
                    zone_id: r.zone_id || zoneId,
                    zone_name: r.zone_name || '',
                    name: r.name,
                    type: r.type,
                    content: r.content || '',
                    proxiable: r.proxiable,
                    proxied: r.proxied || false,
                    ttl: r.ttl,
                    locked: r.locked || false,
                    meta: r.meta || { auto_added: false, managed_by_apps: false, managed_by_argo_tunnel: false },
                    comment: r.comment || undefined,
                    tags: r.tags || [],
                    created_on: r.created_on,
                    modified_on: r.modified_on,
                });
            }
            return { success: true, records };
        }
        catch (error) {
            console.error('[CloudflareService] Failed to list DNS records:', error);
            return { success: false, error: error.message };
        }
    }
    /**
     * Create a DNS record
     */
    async createDNSRecord(zoneId, type, name, content, ttl = 1, proxied = false, comment, priority, data) {
        try {
            const client = this.getClient();
            const recordData = {
                zone_id: zoneId,
                type: type,
                name,
                content,
                ttl,
                comment,
            };
            // Only add proxied for proxyable types
            if (['A', 'AAAA', 'CNAME'].includes(type)) {
                recordData.proxied = proxied;
            }
            // Add priority for MX records
            if (type === 'MX' && priority !== undefined) {
                recordData.priority = priority;
            }
            // Add SRV data
            if (type === 'SRV' && data) {
                recordData.data = {
                    service: data.service,
                    proto: data.proto,
                    name: data.name,
                    priority: data.priority,
                    weight: data.weight,
                    port: data.port,
                    target: data.target,
                };
            }
            const result = await client.dns.records.create(recordData);
            const r = result;
            return {
                success: true,
                record: {
                    id: r.id,
                    zone_id: r.zone_id || zoneId,
                    zone_name: r.zone_name || '',
                    name: r.name,
                    type: r.type,
                    content: r.content || '',
                    proxiable: r.proxiable,
                    proxied: r.proxied || false,
                    ttl: r.ttl,
                    locked: r.locked || false,
                    meta: r.meta || { auto_added: false, managed_by_apps: false, managed_by_argo_tunnel: false },
                    comment: r.comment || undefined,
                    tags: r.tags || [],
                    created_on: r.created_on,
                    modified_on: r.modified_on,
                }
            };
        }
        catch (error) {
            console.error('[CloudflareService] Failed to create DNS record:', error);
            return { success: false, error: error.message };
        }
    }
    /**
     * Update a DNS record
     */
    async updateDNSRecord(zoneId, recordId, type, name, content, ttl = 1, proxied = false, comment, priority, data) {
        try {
            const client = this.getClient();
            const recordData = {
                zone_id: zoneId,
                type: type,
                name,
                content,
                ttl,
                comment,
            };
            // Only add proxied for proxyable types
            if (['A', 'AAAA', 'CNAME'].includes(type)) {
                recordData.proxied = proxied;
            }
            // Add priority for MX records
            if (type === 'MX' && priority !== undefined) {
                recordData.priority = priority;
            }
            // Add SRV data
            if (type === 'SRV' && data) {
                recordData.data = {
                    service: data.service,
                    proto: data.proto,
                    name: data.name,
                    priority: data.priority,
                    weight: data.weight,
                    port: data.port,
                    target: data.target,
                };
            }
            const result = await client.dns.records.update(recordId, recordData);
            const r = result;
            return {
                success: true,
                record: {
                    id: r.id,
                    zone_id: r.zone_id || zoneId,
                    zone_name: r.zone_name || '',
                    name: r.name,
                    type: r.type,
                    content: r.content || '',
                    proxiable: r.proxiable,
                    proxied: r.proxied || false,
                    ttl: r.ttl,
                    locked: r.locked || false,
                    meta: r.meta || { auto_added: false, managed_by_apps: false, managed_by_argo_tunnel: false },
                    comment: r.comment || undefined,
                    tags: r.tags || [],
                    created_on: r.created_on,
                    modified_on: r.modified_on,
                }
            };
        }
        catch (error) {
            console.error('[CloudflareService] Failed to update DNS record:', error);
            return { success: false, error: error.message };
        }
    }
    /**
     * Delete a DNS record
     */
    async deleteDNSRecord(zoneId, recordId) {
        try {
            const client = this.getClient();
            await client.dns.records.delete(recordId, { zone_id: zoneId });
            return { success: true };
        }
        catch (error) {
            console.error('[CloudflareService] Failed to delete DNS record:', error);
            return { success: false, error: error.message };
        }
    }
}
exports.CloudflareService = CloudflareService;
exports.cloudflareService = new CloudflareService();
//# sourceMappingURL=CloudflareService.js.map