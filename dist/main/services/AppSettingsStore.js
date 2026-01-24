"use strict";
/**
 * App Settings Store
 *
 * Persistent storage for application settings using electron-store
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.appSettings = void 0;
const electron_store_1 = __importDefault(require("electron-store"));
const crypto = __importStar(require("crypto"));
const defaults = {
    sessionMonitorEnabled: true,
    terminalFont: 'JetBrains Mono',
    appLockEnabled: false,
    appLockMethod: 'blur',
    appLockTimeout: 5,
    appLockHash: '',
};
class AppSettingsStore {
    constructor() {
        this.store = new electron_store_1.default({
            name: 'app-settings',
            defaults,
        });
    }
    get(key) {
        return this.store.get(key);
    }
    set(key, value) {
        this.store.set(key, value);
    }
    getAll() {
        return this.store.store;
    }
    // Hash PIN or password using SHA-256
    hashCredential(value) {
        return crypto.createHash('sha256').update(value).digest('hex');
    }
    // Verify PIN or password
    verifyCredential(value) {
        const storedHash = this.get('appLockHash');
        if (!storedHash)
            return true;
        return this.hashCredential(value) === storedHash;
    }
    // Set PIN or password (store as hash)
    setCredential(value) {
        this.set('appLockHash', this.hashCredential(value));
    }
    // Clear credential
    clearCredential() {
        this.set('appLockHash', '');
    }
}
exports.appSettings = new AppSettingsStore();
//# sourceMappingURL=AppSettingsStore.js.map