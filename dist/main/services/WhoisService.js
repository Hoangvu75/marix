"use strict";
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
exports.whoisService = exports.WhoisService = void 0;
const net = __importStar(require("net"));
const https = __importStar(require("https"));
const whois_servers_1 = require("./whois-servers");
class WhoisService {
    /**
     * Get the TLD from a domain
     */
    getTLD(domain) {
        const parts = domain.split('.');
        if (parts.length < 2)
            return '';
        // Check for second-level TLDs like co.uk, com.br, etc.
        const lastTwo = parts.slice(-2).join('.');
        const secondLevel = ['co.uk', 'org.uk', 'me.uk', 'com.br', 'net.br', 'org.br', 'com.au', 'net.au', 'org.au', 'co.jp', 'or.jp', 'ne.jp', 'ac.jp', 'co.nz', 'net.nz', 'org.nz', 'com.mx', 'org.mx', 'com.tw', 'org.tw', 'net.tw', 'co.in', 'net.in', 'org.in', 'co.za', 'net.za', 'org.za'];
        if (secondLevel.includes(lastTwo)) {
            return parts[parts.length - 1]; // Return just the ccTLD part
        }
        return parts[parts.length - 1];
    }
    /**
     * Check if TLD uses Google RDAP
     */
    isGoogleRdapTld(tld) {
        return whois_servers_1.GOOGLE_RDAP_TLDS.has(tld.toLowerCase());
    }
    /**
     * Query Google RDAP API
     */
    async queryGoogleRdap(domain) {
        return new Promise((resolve, reject) => {
            const url = `https://pubapi.registry.google/rdap/domain/${domain}`;
            console.log('[WhoisService] Using Google RDAP:', url);
            https.get(url, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    try {
                        if (res.statusCode !== 200) {
                            reject(new Error(`RDAP returned status ${res.statusCode}`));
                            return;
                        }
                        const rdap = JSON.parse(data);
                        const result = this.parseRdapData(domain, rdap);
                        resolve(result);
                    }
                    catch (err) {
                        reject(new Error('Failed to parse RDAP response'));
                    }
                });
            }).on('error', (err) => {
                reject(err);
            });
        });
    }
    /**
     * Format RDAP data as readable text (like traditional WHOIS)
     */
    formatRdapAsText(domain, rdap, result) {
        const lines = [];
        lines.push('Domain Name: ' + (rdap.ldhName || domain).toUpperCase());
        lines.push('Registry Domain ID: ' + (rdap.handle || 'N/A'));
        if (result.registrar) {
            lines.push('Registrar: ' + result.registrar);
        }
        if (result.registrarUrl) {
            lines.push('Registrar URL: ' + result.registrarUrl);
        }
        if (result.adminEmail) {
            lines.push('Registrar Abuse Contact Email: ' + result.adminEmail);
        }
        lines.push('');
        if (result.creationDate) {
            lines.push('Creation Date: ' + result.creationDate);
        }
        if (result.updatedDate) {
            lines.push('Updated Date: ' + result.updatedDate);
        }
        if (result.expirationDate) {
            lines.push('Registry Expiry Date: ' + result.expirationDate);
        }
        lines.push('');
        if (result.status && result.status.length > 0) {
            for (const status of result.status) {
                lines.push('Domain Status: ' + status);
            }
        }
        lines.push('');
        if (result.nameServers && result.nameServers.length > 0) {
            for (const ns of result.nameServers) {
                lines.push('Name Server: ' + ns.toUpperCase());
            }
        }
        lines.push('');
        if (result.dnssec) {
            lines.push('DNSSEC: ' + result.dnssec);
        }
        if (result.registrantName) {
            lines.push('');
            lines.push('Registrant Name: ' + result.registrantName);
        }
        if (result.registrantOrg) {
            lines.push('Registrant Organization: ' + result.registrantOrg);
        }
        lines.push('');
        lines.push('>>> Last update of WHOIS database: ' + new Date().toISOString() + ' <<<');
        lines.push('');
        lines.push('For more information on RDAP, please see https://about.rdap.org');
        return lines.join('\n');
    }
    /**
     * Parse RDAP JSON response into WhoisResult
     */
    parseRdapData(domain, rdap) {
        const result = {
            domain,
            rawData: '', // Will be set after parsing
            status: [],
            nameServers: [],
        };
        // Domain name
        if (rdap.ldhName) {
            result.domain = rdap.ldhName.toLowerCase();
        }
        // Status
        if (rdap.status && Array.isArray(rdap.status)) {
            result.status = rdap.status.map((s) => s.replace(/ /g, ''));
        }
        // Events (dates)
        if (rdap.events && Array.isArray(rdap.events)) {
            for (const event of rdap.events) {
                switch (event.eventAction) {
                    case 'registration':
                        result.creationDate = event.eventDate;
                        break;
                    case 'expiration':
                        result.expirationDate = event.eventDate;
                        break;
                    case 'last changed':
                    case 'last update of RDAP database':
                        if (!result.updatedDate) {
                            result.updatedDate = event.eventDate;
                        }
                        break;
                }
            }
        }
        // Nameservers
        if (rdap.nameservers && Array.isArray(rdap.nameservers)) {
            result.nameServers = rdap.nameservers
                .map((ns) => ns.ldhName?.toLowerCase())
                .filter((ns) => ns);
        }
        // DNSSEC
        if (rdap.secureDNS) {
            result.dnssec = rdap.secureDNS.delegationSigned ? 'signedDelegation' : 'unsigned';
        }
        // Entities (registrar, registrant, etc.)
        if (rdap.entities && Array.isArray(rdap.entities)) {
            for (const entity of rdap.entities) {
                const roles = entity.roles || [];
                // Registrar
                if (roles.includes('registrar')) {
                    // Get registrar name from vcard
                    if (entity.vcardArray && entity.vcardArray[1]) {
                        const vcard = entity.vcardArray[1];
                        const fnEntry = vcard.find((v) => v[0] === 'fn');
                        if (fnEntry) {
                            result.registrar = fnEntry[3];
                        }
                    }
                    // Get registrar URL from links
                    if (entity.links && Array.isArray(entity.links)) {
                        const aboutLink = entity.links.find((l) => l.rel === 'about');
                        if (aboutLink) {
                            result.registrarUrl = aboutLink.href;
                        }
                    }
                    // Check for abuse contact in nested entities
                    if (entity.entities && Array.isArray(entity.entities)) {
                        for (const subEntity of entity.entities) {
                            if (subEntity.roles?.includes('abuse') && subEntity.vcardArray?.[1]) {
                                const vcard = subEntity.vcardArray[1];
                                const emailEntry = vcard.find((v) => v[0] === 'email');
                                if (emailEntry) {
                                    result.adminEmail = emailEntry[3];
                                }
                            }
                        }
                    }
                }
                // Registrant
                if (roles.includes('registrant') && entity.vcardArray?.[1]) {
                    const vcard = entity.vcardArray[1];
                    const fnEntry = vcard.find((v) => v[0] === 'fn');
                    const orgEntry = vcard.find((v) => v[0] === 'org');
                    if (fnEntry) {
                        result.registrantName = fnEntry[3];
                    }
                    if (orgEntry) {
                        result.registrantOrg = orgEntry[3];
                    }
                }
            }
        }
        // Format rawData as readable text instead of JSON
        result.rawData = this.formatRdapAsText(domain, rdap, result);
        return result;
    }
    /**
     * Get WHOIS server for a domain
     */
    getWhoisServer(domain) {
        const tld = this.getTLD(domain);
        return whois_servers_1.WHOIS_SERVERS[tld] || 'whois.iana.org';
    }
    /**
     * Query a WHOIS server directly using TCP socket
     */
    async queryWhoisServer(server, domain) {
        return new Promise((resolve, reject) => {
            let data = '';
            const socket = new net.Socket();
            socket.setTimeout(whois_servers_1.WHOIS_TIMEOUT);
            socket.on('connect', () => {
                socket.write(`${domain}\r\n`);
            });
            socket.on('data', (chunk) => {
                data += chunk.toString('utf8');
            });
            socket.on('end', () => {
                resolve(data);
            });
            socket.on('timeout', () => {
                socket.destroy();
                reject(new Error(`Connection to ${server} timed out`));
            });
            socket.on('error', (err) => {
                reject(err);
            });
            socket.connect(whois_servers_1.WHOIS_PORT, server);
        });
    }
    /**
     * Lookup domain WHOIS information
     */
    async lookup(domain) {
        try {
            // Clean up domain
            const cleanDomain = domain.trim().toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
            console.log('[WhoisService] Looking up:', cleanDomain);
            const tld = this.getTLD(cleanDomain);
            console.log('[WhoisService] TLD:', tld);
            // Check if this TLD uses Google RDAP
            if (this.isGoogleRdapTld(tld)) {
                console.log('[WhoisService] Using Google RDAP for TLD:', tld);
                const result = await this.queryGoogleRdap(cleanDomain);
                return { success: true, result };
            }
            // Traditional WHOIS query
            const server = this.getWhoisServer(cleanDomain);
            console.log('[WhoisService] Using WHOIS server:', server);
            let rawData = await this.queryWhoisServer(server, cleanDomain);
            // Check for referral to another server (common for .com, .net)
            const referralMatch = rawData.match(/Registrar WHOIS Server:\s*(\S+)/i) ||
                rawData.match(/Whois Server:\s*(\S+)/i);
            if (referralMatch && referralMatch[1] && referralMatch[1] !== server) {
                const referralServer = referralMatch[1].toLowerCase();
                console.log('[WhoisService] Following referral to:', referralServer);
                try {
                    const referralData = await this.queryWhoisServer(referralServer, cleanDomain);
                    if (referralData && referralData.length > rawData.length / 2) {
                        rawData = referralData + '\n\n--- Registry Data ---\n' + rawData;
                    }
                }
                catch (refErr) {
                    console.warn('[WhoisService] Referral query failed:', refErr);
                }
            }
            const result = this.parseWhoisData(cleanDomain, rawData);
            return { success: true, result };
        }
        catch (error) {
            console.error('[WhoisService] Lookup failed:', error);
            return { success: false, error: error.message || 'Lookup failed' };
        }
    }
    /**
     * Parse raw WHOIS data into structured format
     */
    parseWhoisData(domain, rawData) {
        const result = {
            domain,
            rawData,
            status: [],
            nameServers: [],
        };
        const lines = rawData.split('\n');
        for (const line of lines) {
            const colonIndex = line.indexOf(':');
            if (colonIndex === -1)
                continue;
            const key = line.substring(0, colonIndex).trim().toLowerCase();
            const value = line.substring(colonIndex + 1).trim();
            if (!value)
                continue;
            // Registrar
            if (key === 'registrar' || key === 'registrar name' || key === 'sponsoring registrar') {
                if (!result.registrar)
                    result.registrar = value;
            }
            // Registrar URL
            if (key === 'registrar url' || key === 'registrar-url') {
                result.registrarUrl = value;
            }
            // Creation date
            if (key === 'creation date' || key === 'created' || key === 'created date' ||
                key === 'registration date' || key === 'domain registration date' ||
                key === 'created on' || key === 'registered on' || key === 'registered') {
                if (!result.creationDate)
                    result.creationDate = value;
            }
            // Expiration date
            if (key === 'registry expiry date' || key === 'registrar registration expiration date' ||
                key === 'expiration date' || key === 'expiry date' || key === 'expires' ||
                key === 'expires on' || key === 'paid-till' || key === 'expiry') {
                if (!result.expirationDate)
                    result.expirationDate = value;
            }
            // Updated date
            if (key === 'updated date' || key === 'last updated' || key === 'last modified' ||
                key === 'modified' || key === 'changed' || key === 'last update') {
                if (!result.updatedDate)
                    result.updatedDate = value;
            }
            // Status
            if (key === 'domain status' || key === 'status') {
                const statusValue = value.split(' ')[0]; // Remove URL after status
                if (statusValue && !result.status.includes(statusValue)) {
                    result.status.push(statusValue);
                }
            }
            // Nameservers
            if (key === 'name server' || key === 'nameserver' || key === 'nserver' || key === 'ns') {
                const ns = value.toLowerCase().split(' ')[0];
                if (ns && !result.nameServers.includes(ns)) {
                    result.nameServers.push(ns);
                }
            }
            // DNSSEC
            if (key === 'dnssec') {
                result.dnssec = value;
            }
            // Registrant
            if (key === 'registrant name' || key === 'registrant') {
                if (!result.registrantName)
                    result.registrantName = value;
            }
            if (key === 'registrant organization' || key === 'registrant org') {
                if (!result.registrantOrg)
                    result.registrantOrg = value;
            }
            if (key === 'registrant country' || key === 'registrant country/economy') {
                if (!result.registrantCountry)
                    result.registrantCountry = value;
            }
            // Admin email
            if (key === 'admin email' || key === 'administrative contact email' || key === 'registrar abuse contact email') {
                if (!result.adminEmail)
                    result.adminEmail = value;
            }
            // Tech email
            if (key === 'tech email' || key === 'technical contact email') {
                if (!result.techEmail)
                    result.techEmail = value;
            }
        }
        return result;
    }
}
exports.WhoisService = WhoisService;
exports.whoisService = new WhoisService();
//# sourceMappingURL=WhoisService.js.map