"use strict";
/**
 * SecureStorage - Encrypts sensitive data using OS-level keychain
 *
 * Uses Electron's safeStorage API which leverages:
 * - macOS: Keychain
 * - Windows: DPAPI (Data Protection API)
 * - Linux: libsecret (GNOME Keyring, KWallet, etc.)
 *
 * Data encrypted on one machine CANNOT be decrypted on another machine.
 * This is intentional for security - credentials are tied to the device.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecureStorage = void 0;
const electron_1 = require("electron");
// Prefix to identify encrypted strings
const ENCRYPTED_PREFIX = 'enc:';
class SecureStorage {
    /**
     * Check if encryption is available on this system
     */
    static isAvailable() {
        return electron_1.safeStorage.isEncryptionAvailable();
    }
    /**
     * Encrypt a string using OS-level encryption
     * Returns the encrypted string with a prefix, or original if encryption unavailable
     */
    static encrypt(plaintext) {
        if (!plaintext)
            return plaintext;
        // Already encrypted? Return as-is
        if (plaintext.startsWith(ENCRYPTED_PREFIX)) {
            return plaintext;
        }
        try {
            if (electron_1.safeStorage.isEncryptionAvailable()) {
                const encrypted = electron_1.safeStorage.encryptString(plaintext);
                return ENCRYPTED_PREFIX + encrypted.toString('base64');
            }
        }
        catch (error) {
            console.error('[SecureStorage] Encryption failed:', error);
        }
        // Fallback: return original (not recommended, but prevents data loss)
        return plaintext;
    }
    /**
     * Decrypt a string that was encrypted with encrypt()
     * Returns the decrypted string, or original if not encrypted/decryption fails
     */
    static decrypt(ciphertext) {
        if (!ciphertext)
            return ciphertext;
        // Not encrypted? Return as-is
        if (!ciphertext.startsWith(ENCRYPTED_PREFIX)) {
            return ciphertext;
        }
        try {
            if (electron_1.safeStorage.isEncryptionAvailable()) {
                const base64Data = ciphertext.slice(ENCRYPTED_PREFIX.length);
                const buffer = Buffer.from(base64Data, 'base64');
                return electron_1.safeStorage.decryptString(buffer);
            }
        }
        catch (error) {
            console.error('[SecureStorage] Decryption failed:', error);
        }
        // Return empty string if decryption fails (prevents showing encrypted gibberish)
        return '';
    }
    /**
     * Check if a string is encrypted
     */
    static isEncrypted(value) {
        return value?.startsWith(ENCRYPTED_PREFIX) ?? false;
    }
    /**
     * Encrypt multiple fields in an object
     * @param obj The object to process
     * @param fields Array of field names to encrypt
     * @returns New object with encrypted fields
     */
    static encryptFields(obj, fields) {
        const result = { ...obj };
        for (const field of fields) {
            const value = result[field];
            if (typeof value === 'string' && value) {
                result[field] = this.encrypt(value);
            }
        }
        return result;
    }
    /**
     * Decrypt multiple fields in an object
     * @param obj The object to process
     * @param fields Array of field names to decrypt
     * @returns New object with decrypted fields
     */
    static decryptFields(obj, fields) {
        const result = { ...obj };
        for (const field of fields) {
            const value = result[field];
            if (typeof value === 'string' && value) {
                result[field] = this.decrypt(value);
            }
        }
        return result;
    }
}
exports.SecureStorage = SecureStorage;
//# sourceMappingURL=SecureStorage.js.map