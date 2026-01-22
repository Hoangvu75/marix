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
exports.networkToolsService = exports.NetworkToolsService = void 0;
const dns = __importStar(require("dns"));
const net = __importStar(require("net"));
const http = __importStar(require("http"));
const https = __importStar(require("https"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const WhoisService_1 = require("./WhoisService");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
const dnsResolve = (0, util_1.promisify)(dns.resolve);
const dnsResolve4 = (0, util_1.promisify)(dns.resolve4);
const dnsResolve6 = (0, util_1.promisify)(dns.resolve6);
const dnsResolveMx = (0, util_1.promisify)(dns.resolveMx);
const dnsResolveTxt = (0, util_1.promisify)(dns.resolveTxt);
const dnsResolveCname = (0, util_1.promisify)(dns.resolveCname);
const dnsResolveNs = (0, util_1.promisify)(dns.resolveNs);
const dnsResolveSoa = (0, util_1.promisify)(dns.resolveSoa);
const dnsResolvePtr = (0, util_1.promisify)(dns.resolvePtr);
const dnsReverse = (0, util_1.promisify)(dns.reverse);
// DNS Blacklist servers
const BLACKLIST_SERVERS = [
    'zen.spamhaus.org',
    'bl.spamcop.net',
    'b.barracudacentral.org',
    'dnsbl.sorbs.net',
    'spam.dnsbl.sorbs.net',
    'cbl.abuseat.org',
    'dnsbl-1.uceprotect.net',
    'psbl.surriel.com',
    'all.s5h.net',
    'rbl.interserver.net'
];
class NetworkToolsService {
    // MX Lookup - Get MX records for a domain
    async mxLookup(domain) {
        try {
            const records = await dnsResolveMx(domain);
            const sorted = records.sort((a, b) => a.priority - b.priority);
            return {
                success: true,
                tool: 'mx',
                target: domain,
                data: sorted,
                timestamp: new Date().toISOString()
            };
        }
        catch (error) {
            return {
                success: false,
                tool: 'mx',
                target: domain,
                error: error.message || 'Failed to lookup MX records',
                timestamp: new Date().toISOString()
            };
        }
    }
    // A Record Lookup
    async aLookup(hostname) {
        try {
            const addresses = await dnsResolve4(hostname);
            return {
                success: true,
                tool: 'a',
                target: hostname,
                data: addresses,
                timestamp: new Date().toISOString()
            };
        }
        catch (error) {
            return {
                success: false,
                tool: 'a',
                target: hostname,
                error: error.message || 'Failed to lookup A record',
                timestamp: new Date().toISOString()
            };
        }
    }
    // AAAA Record Lookup (IPv6)
    async aaaaLookup(hostname) {
        try {
            const addresses = await dnsResolve6(hostname);
            return {
                success: true,
                tool: 'aaaa',
                target: hostname,
                data: addresses,
                timestamp: new Date().toISOString()
            };
        }
        catch (error) {
            return {
                success: false,
                tool: 'aaaa',
                target: hostname,
                error: error.message || 'Failed to lookup AAAA record',
                timestamp: new Date().toISOString()
            };
        }
    }
    // TXT Record Lookup
    async txtLookup(domain) {
        try {
            const records = await dnsResolveTxt(domain);
            // Flatten the array of arrays
            const flatRecords = records.map(r => r.join(''));
            return {
                success: true,
                tool: 'txt',
                target: domain,
                data: flatRecords,
                timestamp: new Date().toISOString()
            };
        }
        catch (error) {
            return {
                success: false,
                tool: 'txt',
                target: domain,
                error: error.message || 'Failed to lookup TXT records',
                timestamp: new Date().toISOString()
            };
        }
    }
    // SPF Record Lookup (TXT records that start with v=spf1)
    async spfLookup(domain) {
        try {
            const records = await dnsResolveTxt(domain);
            const flatRecords = records.map(r => r.join(''));
            const spfRecords = flatRecords.filter(r => r.toLowerCase().startsWith('v=spf1'));
            return {
                success: true,
                tool: 'spf',
                target: domain,
                data: spfRecords.length > 0 ? spfRecords : ['No SPF record found'],
                timestamp: new Date().toISOString()
            };
        }
        catch (error) {
            return {
                success: false,
                tool: 'spf',
                target: domain,
                error: error.message || 'Failed to lookup SPF record',
                timestamp: new Date().toISOString()
            };
        }
    }
    // CNAME Lookup
    async cnameLookup(hostname) {
        try {
            const records = await dnsResolveCname(hostname);
            return {
                success: true,
                tool: 'cname',
                target: hostname,
                data: records,
                timestamp: new Date().toISOString()
            };
        }
        catch (error) {
            return {
                success: false,
                tool: 'cname',
                target: hostname,
                error: error.message || 'Failed to lookup CNAME record',
                timestamp: new Date().toISOString()
            };
        }
    }
    // NS Lookup
    async nsLookup(domain) {
        try {
            const records = await dnsResolveNs(domain);
            return {
                success: true,
                tool: 'ns',
                target: domain,
                data: records,
                timestamp: new Date().toISOString()
            };
        }
        catch (error) {
            return {
                success: false,
                tool: 'ns',
                target: domain,
                error: error.message || 'Failed to lookup NS records',
                timestamp: new Date().toISOString()
            };
        }
    }
    // SOA Lookup
    async soaLookup(domain) {
        try {
            const record = await dnsResolveSoa(domain);
            return {
                success: true,
                tool: 'soa',
                target: domain,
                data: record,
                timestamp: new Date().toISOString()
            };
        }
        catch (error) {
            return {
                success: false,
                tool: 'soa',
                target: domain,
                error: error.message || 'Failed to lookup SOA record',
                timestamp: new Date().toISOString()
            };
        }
    }
    // PTR Lookup (Reverse DNS)
    async ptrLookup(ip) {
        try {
            const hostnames = await dnsReverse(ip);
            return {
                success: true,
                tool: 'ptr',
                target: ip,
                data: hostnames,
                timestamp: new Date().toISOString()
            };
        }
        catch (error) {
            return {
                success: false,
                tool: 'ptr',
                target: ip,
                error: error.message || 'Failed to lookup PTR record',
                timestamp: new Date().toISOString()
            };
        }
    }
    // Ping - using execFile to prevent command injection
    async ping(host, count = 4) {
        return new Promise((resolve) => {
            const isWindows = process.platform === 'win32';
            const command = 'ping';
            const args = isWindows
                ? ['-n', count.toString(), host]
                : ['-c', count.toString(), host];
            // execFile automatically escapes arguments, preventing command injection
            (0, child_process_1.execFile)(command, args, { timeout: 30000 }, (error, stdout, stderr) => {
                if (error) {
                    resolve({
                        success: false,
                        tool: 'ping',
                        target: host,
                        error: error.message || 'Ping failed',
                        data: stdout || stderr,
                        timestamp: new Date().toISOString()
                    });
                }
                else {
                    resolve({
                        success: true,
                        tool: 'ping',
                        target: host,
                        data: stdout,
                        timestamp: new Date().toISOString()
                    });
                }
            });
        });
    }
    // Traceroute - using execFile to prevent command injection
    async traceroute(host) {
        return new Promise((resolve) => {
            const isWindows = process.platform === 'win32';
            const command = isWindows ? 'tracert' : 'traceroute';
            const args = isWindows ? ['-d', host] : ['-n', host];
            // execFile automatically escapes arguments, preventing command injection
            (0, child_process_1.execFile)(command, args, { timeout: 60000 }, (error, stdout, stderr) => {
                if (error) {
                    resolve({
                        success: false,
                        tool: 'trace',
                        target: host,
                        error: error.message || 'Traceroute failed',
                        data: stdout || stderr,
                        timestamp: new Date().toISOString()
                    });
                }
                else {
                    resolve({
                        success: true,
                        tool: 'trace',
                        target: host,
                        data: stdout,
                        timestamp: new Date().toISOString()
                    });
                }
            });
        });
    }
    // TCP Connection Test
    async tcpTest(host, port, timeout = 5000) {
        return new Promise((resolve) => {
            const socket = new net.Socket();
            const startTime = Date.now();
            socket.setTimeout(timeout);
            socket.on('connect', () => {
                const latency = Date.now() - startTime;
                socket.destroy();
                resolve({
                    success: true,
                    tool: 'tcp',
                    target: `${host}:${port}`,
                    data: {
                        connected: true,
                        latency: `${latency}ms`,
                        port: port
                    },
                    timestamp: new Date().toISOString()
                });
            });
            socket.on('timeout', () => {
                socket.destroy();
                resolve({
                    success: false,
                    tool: 'tcp',
                    target: `${host}:${port}`,
                    error: 'Connection timed out',
                    timestamp: new Date().toISOString()
                });
            });
            socket.on('error', (err) => {
                socket.destroy();
                resolve({
                    success: false,
                    tool: 'tcp',
                    target: `${host}:${port}`,
                    error: err.message || 'Connection failed',
                    timestamp: new Date().toISOString()
                });
            });
            socket.connect(port, host);
        });
    }
    // HTTP Check
    async httpCheck(url, timeout = 10000) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            try {
                const urlObj = new URL(url.startsWith('http') ? url : `http://${url}`);
                const req = http.get(urlObj.href, { timeout }, (res) => {
                    const latency = Date.now() - startTime;
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        resolve({
                            success: res.statusCode !== undefined && res.statusCode < 400,
                            tool: 'http',
                            target: url,
                            data: {
                                statusCode: res.statusCode,
                                statusMessage: res.statusMessage,
                                latency: `${latency}ms`,
                                headers: res.headers,
                                contentLength: data.length
                            },
                            timestamp: new Date().toISOString()
                        });
                    });
                });
                req.on('timeout', () => {
                    req.destroy();
                    resolve({
                        success: false,
                        tool: 'http',
                        target: url,
                        error: 'Request timed out',
                        timestamp: new Date().toISOString()
                    });
                });
                req.on('error', (err) => {
                    resolve({
                        success: false,
                        tool: 'http',
                        target: url,
                        error: err.message || 'HTTP request failed',
                        timestamp: new Date().toISOString()
                    });
                });
            }
            catch (error) {
                resolve({
                    success: false,
                    tool: 'http',
                    target: url,
                    error: error.message || 'Invalid URL',
                    timestamp: new Date().toISOString()
                });
            }
        });
    }
    // HTTPS Check
    async httpsCheck(url, timeout = 10000) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            try {
                const urlObj = new URL(url.startsWith('https') ? url : `https://${url}`);
                const req = https.get(urlObj.href, { timeout, rejectUnauthorized: false }, (res) => {
                    const latency = Date.now() - startTime;
                    let data = '';
                    const socket = res.socket;
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        const cert = socket.getPeerCertificate ? socket.getPeerCertificate() : null;
                        resolve({
                            success: res.statusCode !== undefined && res.statusCode < 400,
                            tool: 'https',
                            target: url,
                            data: {
                                statusCode: res.statusCode,
                                statusMessage: res.statusMessage,
                                latency: `${latency}ms`,
                                ssl: cert ? {
                                    valid: socket.authorized,
                                    issuer: cert.issuer,
                                    subject: cert.subject,
                                    validFrom: cert.valid_from,
                                    validTo: cert.valid_to
                                } : null,
                                contentLength: data.length
                            },
                            timestamp: new Date().toISOString()
                        });
                    });
                });
                req.on('timeout', () => {
                    req.destroy();
                    resolve({
                        success: false,
                        tool: 'https',
                        target: url,
                        error: 'Request timed out',
                        timestamp: new Date().toISOString()
                    });
                });
                req.on('error', (err) => {
                    resolve({
                        success: false,
                        tool: 'https',
                        target: url,
                        error: err.message || 'HTTPS request failed',
                        timestamp: new Date().toISOString()
                    });
                });
            }
            catch (error) {
                resolve({
                    success: false,
                    tool: 'https',
                    target: url,
                    error: error.message || 'Invalid URL',
                    timestamp: new Date().toISOString()
                });
            }
        });
    }
    // SMTP Test
    async smtpTest(host, port = 25, timeout = 10000) {
        return new Promise((resolve) => {
            const socket = new net.Socket();
            const startTime = Date.now();
            let response = '';
            socket.setTimeout(timeout);
            socket.on('connect', () => {
                // Wait for SMTP banner
            });
            socket.on('data', (data) => {
                response += data.toString();
                const latency = Date.now() - startTime;
                // Check if we got the SMTP banner (220)
                if (response.includes('220') || response.includes('250')) {
                    socket.write('QUIT\r\n');
                    setTimeout(() => {
                        socket.destroy();
                        resolve({
                            success: true,
                            tool: 'smtp',
                            target: `${host}:${port}`,
                            data: {
                                connected: true,
                                latency: `${latency}ms`,
                                banner: response.trim().split('\n')[0],
                                fullResponse: response.trim()
                            },
                            timestamp: new Date().toISOString()
                        });
                    }, 500);
                }
            });
            socket.on('timeout', () => {
                socket.destroy();
                resolve({
                    success: false,
                    tool: 'smtp',
                    target: `${host}:${port}`,
                    error: 'Connection timed out',
                    data: response || null,
                    timestamp: new Date().toISOString()
                });
            });
            socket.on('error', (err) => {
                socket.destroy();
                resolve({
                    success: false,
                    tool: 'smtp',
                    target: `${host}:${port}`,
                    error: err.message || 'SMTP connection failed',
                    timestamp: new Date().toISOString()
                });
            });
            socket.connect(port, host);
        });
    }
    // Blacklist Check
    async blacklistCheck(ip) {
        const results = [];
        // Reverse IP for DNSBL query
        const reversedIp = ip.split('.').reverse().join('.');
        const checks = BLACKLIST_SERVERS.map(async (server) => {
            const query = `${reversedIp}.${server}`;
            try {
                await dnsResolve4(query);
                // If we get a result, the IP is listed
                results.push({ server, listed: true });
            }
            catch (error) {
                if (error.code === 'ENOTFOUND' || error.code === 'ENODATA') {
                    // Not listed
                    results.push({ server, listed: false });
                }
                else {
                    results.push({ server, listed: false, error: error.message });
                }
            }
        });
        await Promise.all(checks);
        const listedCount = results.filter(r => r.listed).length;
        return {
            success: true,
            tool: 'blacklist',
            target: ip,
            data: {
                ip,
                totalChecked: BLACKLIST_SERVERS.length,
                listedOn: listedCount,
                clean: listedCount === 0,
                results: results.sort((a, b) => (b.listed ? 1 : 0) - (a.listed ? 1 : 0))
            },
            timestamp: new Date().toISOString()
        };
    }
    // DNS Server Check (check if domain's DNS servers are responding)
    async dnsCheck(domain) {
        try {
            const nsRecords = await dnsResolveNs(domain);
            const results = [];
            for (const ns of nsRecords) {
                const startTime = Date.now();
                try {
                    const ips = await dnsResolve4(ns);
                    const latency = Date.now() - startTime;
                    results.push({
                        ns,
                        ip: ips[0],
                        responding: true,
                        latency: `${latency}ms`
                    });
                }
                catch (error) {
                    results.push({
                        ns,
                        responding: false,
                        error: error.message
                    });
                }
            }
            return {
                success: true,
                tool: 'dns',
                target: domain,
                data: {
                    domain,
                    nameservers: results,
                    allResponding: results.every(r => r.responding)
                },
                timestamp: new Date().toISOString()
            };
        }
        catch (error) {
            return {
                success: false,
                tool: 'dns',
                target: domain,
                error: error.message || 'Failed to check DNS servers',
                timestamp: new Date().toISOString()
            };
        }
    }
    // ARIN/IP Info (using ip-api.com)
    async arinLookup(ip) {
        return new Promise((resolve) => {
            http.get(`http://ip-api.com/json/${ip}`, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        resolve({
                            success: json.status === 'success',
                            tool: 'arin',
                            target: ip,
                            data: json,
                            error: json.status === 'fail' ? json.message : undefined,
                            timestamp: new Date().toISOString()
                        });
                    }
                    catch (e) {
                        resolve({
                            success: false,
                            tool: 'arin',
                            target: ip,
                            error: 'Failed to parse response',
                            timestamp: new Date().toISOString()
                        });
                    }
                });
            }).on('error', (err) => {
                resolve({
                    success: false,
                    tool: 'arin',
                    target: ip,
                    error: err.message,
                    timestamp: new Date().toISOString()
                });
            });
        });
    }
    // WHOIS Lookup - delegates to WhoisService
    async whoisLookup(domain) {
        // Clean up domain
        const cleanDomain = domain.trim().toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
        const result = await WhoisService_1.whoisService.lookup(cleanDomain);
        if (!result.success) {
            return {
                success: false,
                tool: 'whois',
                target: cleanDomain,
                error: result.error || 'WHOIS lookup failed',
                timestamp: new Date().toISOString()
            };
        }
        return {
            success: true,
            tool: 'whois',
            target: cleanDomain,
            data: result.result,
            timestamp: new Date().toISOString()
        };
    }
    // Combined HTTP/HTTPS Check
    async webCheck(url) {
        // Ensure URL has protocol
        let testUrl = url.trim();
        if (!testUrl.startsWith('http://') && !testUrl.startsWith('https://')) {
            testUrl = 'https://' + testUrl;
        }
        const isHttps = testUrl.startsWith('https://');
        const results = {
            url: testUrl,
            https: null,
            http: null,
            ssl: null,
        };
        // Test HTTPS
        if (isHttps || !testUrl.startsWith('http://')) {
            const httpsUrl = testUrl.replace(/^http:\/\//, 'https://');
            results.https = await this.httpsCheck(httpsUrl);
        }
        // Test HTTP
        const httpUrl = testUrl.replace(/^https:\/\//, 'http://');
        results.http = await this.httpCheck(httpUrl);
        return {
            success: results.https?.success || results.http?.success,
            tool: 'webcheck',
            target: url,
            data: results,
            timestamp: new Date().toISOString()
        };
    }
    // Advanced SMTP Test with authentication and email sending
    async advancedSmtpTest(config) {
        const startTime = Date.now();
        const tls = require('tls');
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                resolve({
                    success: false,
                    tool: 'smtp-advanced',
                    target: `${config.server}:${config.port}`,
                    error: 'Connection timeout',
                    timestamp: new Date().toISOString()
                });
            }, 30000);
            const useDirectTls = config.encryption === 'ssl' || config.port === 465;
            let socket;
            let banner = '';
            let greeting = '';
            let authSuccess = false;
            let emailSent = false;
            let buffer = '';
            let state = 'banner';
            const sendCommand = (cmd) => {
                socket.write(cmd + '\r\n');
            };
            const handleResponse = (data) => {
                buffer += data;
                const lines = buffer.split('\r\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    if (!line)
                        continue;
                    const code = parseInt(line.substring(0, 3));
                    const continued = line.charAt(3) === '-';
                    if (continued)
                        continue;
                    switch (state) {
                        case 'banner':
                            banner = line;
                            state = 'ehlo';
                            sendCommand('EHLO localhost');
                            break;
                        case 'ehlo':
                            greeting = line;
                            if (code === 250) {
                                if (!useDirectTls && config.encryption === 'starttls') {
                                    state = 'starttls';
                                    sendCommand('STARTTLS');
                                }
                                else if (config.useAuth && config.username && config.password) {
                                    state = 'auth_login';
                                    sendCommand('AUTH LOGIN');
                                }
                                else if (config.fromEmail && config.toEmail) {
                                    state = 'mail_from';
                                    sendCommand(`MAIL FROM:<${config.fromEmail}>`);
                                }
                                else {
                                    state = 'quit';
                                    sendCommand('QUIT');
                                }
                            }
                            break;
                        case 'starttls':
                            if (code === 220) {
                                socket = tls.connect({
                                    socket: socket,
                                    servername: config.server,
                                    rejectUnauthorized: false,
                                }, () => {
                                    state = 'ehlo';
                                    sendCommand('EHLO localhost');
                                });
                                socket.on('data', (d) => handleResponse(d.toString()));
                            }
                            break;
                        case 'auth_login':
                            if (code === 334) {
                                state = 'auth_user';
                                sendCommand(Buffer.from(config.username || '').toString('base64'));
                            }
                            else {
                                state = 'quit';
                                sendCommand('QUIT');
                            }
                            break;
                        case 'auth_user':
                            if (code === 334) {
                                state = 'auth_pass';
                                sendCommand(Buffer.from(config.password || '').toString('base64'));
                            }
                            break;
                        case 'auth_pass':
                            if (code === 235) {
                                authSuccess = true;
                                if (config.fromEmail && config.toEmail) {
                                    state = 'mail_from';
                                    sendCommand(`MAIL FROM:<${config.fromEmail}>`);
                                }
                                else {
                                    state = 'quit';
                                    sendCommand('QUIT');
                                }
                            }
                            else {
                                state = 'quit';
                                sendCommand('QUIT');
                            }
                            break;
                        case 'mail_from':
                            if (code === 250) {
                                state = 'rcpt_to';
                                sendCommand(`RCPT TO:<${config.toEmail}>`);
                            }
                            else {
                                state = 'quit';
                                sendCommand('QUIT');
                            }
                            break;
                        case 'rcpt_to':
                            if (code === 250) {
                                state = 'data';
                                sendCommand('DATA');
                            }
                            else {
                                state = 'quit';
                                sendCommand('QUIT');
                            }
                            break;
                        case 'data':
                            if (code === 354) {
                                state = 'content';
                                const emailContent = [
                                    `From: ${config.fromEmail}`,
                                    `To: ${config.toEmail}`,
                                    `Subject: Marix SMTP Test`,
                                    `Date: ${new Date().toUTCString()}`,
                                    '',
                                    'This is a test email from Marix SSH Client.',
                                    '.',
                                ];
                                sendCommand(emailContent.join('\r\n'));
                            }
                            break;
                        case 'content':
                            if (code === 250) {
                                emailSent = true;
                            }
                            state = 'quit';
                            sendCommand('QUIT');
                            break;
                        case 'quit':
                            clearTimeout(timeout);
                            socket.end();
                            const responseTime = Date.now() - startTime;
                            resolve({
                                success: true,
                                tool: 'smtp-advanced',
                                target: `${config.server}:${config.port}`,
                                data: {
                                    banner,
                                    greeting,
                                    authSuccess: config.useAuth ? authSuccess : undefined,
                                    emailSent: (config.fromEmail && config.toEmail) ? emailSent : undefined,
                                    responseTime,
                                },
                                timestamp: new Date().toISOString()
                            });
                            break;
                    }
                }
            };
            const connectOptions = {
                host: config.server,
                port: config.port,
                rejectUnauthorized: false,
            };
            if (useDirectTls) {
                socket = tls.connect(connectOptions, () => {
                    socket.on('data', (d) => handleResponse(d.toString()));
                });
            }
            else {
                socket = net.connect(connectOptions, () => {
                    socket.on('data', (d) => handleResponse(d.toString()));
                });
            }
            socket.on('error', (err) => {
                clearTimeout(timeout);
                resolve({
                    success: false,
                    tool: 'smtp-advanced',
                    target: `${config.server}:${config.port}`,
                    error: err.message,
                    timestamp: new Date().toISOString()
                });
            });
        });
    }
    // Proxy Check
    async proxyCheck(config) {
        const startTime = Date.now();
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                resolve({
                    success: false,
                    tool: 'proxy',
                    target: `${config.type}://${config.server}:${config.port}`,
                    error: 'Connection timeout',
                    timestamp: new Date().toISOString()
                });
            }, 30000);
            if (config.type === 'http') {
                // HTTP CONNECT proxy
                const url = new URL(config.testUrl);
                const targetHost = url.hostname;
                const targetPort = url.port || (url.protocol === 'https:' ? 443 : 80);
                const isHttps = url.protocol === 'https:';
                const socket = net.connect({
                    host: config.server,
                    port: config.port,
                }, () => {
                    let connectRequest = `CONNECT ${targetHost}:${targetPort} HTTP/1.1\r\nHost: ${targetHost}:${targetPort}\r\n`;
                    if (config.username && config.password) {
                        const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');
                        connectRequest += `Proxy-Authorization: Basic ${auth}\r\n`;
                    }
                    connectRequest += '\r\n';
                    socket.write(connectRequest);
                });
                let responseData = '';
                socket.on('data', (data) => {
                    responseData += data.toString();
                    if (responseData.includes('\r\n\r\n')) {
                        const statusLine = responseData.split('\r\n')[0];
                        const statusCode = parseInt(statusLine.split(' ')[1]);
                        if (statusCode === 200) {
                            if (isHttps) {
                                const tls = require('tls');
                                const tlsSocket = tls.connect({
                                    socket: socket,
                                    servername: targetHost,
                                    rejectUnauthorized: false,
                                }, () => {
                                    tlsSocket.write(`GET ${url.pathname || '/'} HTTP/1.1\r\nHost: ${targetHost}\r\nConnection: close\r\n\r\n`);
                                });
                                let httpResponse = '';
                                tlsSocket.on('data', (d) => {
                                    httpResponse += d.toString();
                                });
                                tlsSocket.on('end', () => {
                                    clearTimeout(timeout);
                                    const responseTime = Date.now() - startTime;
                                    const respStatusCode = parseInt(httpResponse.split('\r\n')[0].split(' ')[1]) || 0;
                                    resolve({
                                        success: true,
                                        tool: 'proxy',
                                        target: `${config.type}://${config.server}:${config.port}`,
                                        data: {
                                            responseTime,
                                            statusCode: respStatusCode,
                                            proxyType: config.type,
                                        },
                                        timestamp: new Date().toISOString()
                                    });
                                });
                            }
                            else {
                                socket.write(`GET ${url.pathname || '/'} HTTP/1.1\r\nHost: ${targetHost}\r\nConnection: close\r\n\r\n`);
                                responseData = '';
                                socket.once('data', (d) => {
                                    clearTimeout(timeout);
                                    const responseTime = Date.now() - startTime;
                                    const resp = d.toString();
                                    const respStatusCode = parseInt(resp.split('\r\n')[0].split(' ')[1]) || 0;
                                    socket.end();
                                    resolve({
                                        success: true,
                                        tool: 'proxy',
                                        target: `${config.type}://${config.server}:${config.port}`,
                                        data: {
                                            responseTime,
                                            statusCode: respStatusCode,
                                            proxyType: config.type,
                                        },
                                        timestamp: new Date().toISOString()
                                    });
                                });
                            }
                        }
                        else {
                            clearTimeout(timeout);
                            socket.end();
                            resolve({
                                success: false,
                                tool: 'proxy',
                                target: `${config.type}://${config.server}:${config.port}`,
                                error: `Proxy returned status ${statusCode}`,
                                timestamp: new Date().toISOString()
                            });
                        }
                    }
                });
                socket.on('error', (err) => {
                    clearTimeout(timeout);
                    resolve({
                        success: false,
                        tool: 'proxy',
                        target: `${config.type}://${config.server}:${config.port}`,
                        error: err.message,
                        timestamp: new Date().toISOString()
                    });
                });
            }
            else {
                // SOCKS proxy
                const socket = net.connect({
                    host: config.server,
                    port: config.port,
                }, () => {
                    const url = new URL(config.testUrl);
                    const targetHost = url.hostname;
                    const targetPort = parseInt(url.port) || (url.protocol === 'https:' ? 443 : 80);
                    if (config.type === 'socks4') {
                        // SOCKS4 connect request
                        dns.lookup(targetHost, 4, (err, address) => {
                            if (err) {
                                clearTimeout(timeout);
                                socket.end();
                                resolve({
                                    success: false,
                                    tool: 'proxy',
                                    target: `${config.type}://${config.server}:${config.port}`,
                                    error: `DNS lookup failed: ${err.message}`,
                                    timestamp: new Date().toISOString()
                                });
                                return;
                            }
                            const ipParts = address.split('.').map(Number);
                            const request = Buffer.from([
                                0x04, // SOCKS version
                                0x01, // Connect command
                                (targetPort >> 8) & 0xff, targetPort & 0xff, // Port
                                ...ipParts, // IP
                                0x00, // Null terminated user ID
                            ]);
                            socket.write(request);
                        });
                    }
                    else {
                        // SOCKS5
                        const authMethod = (config.username && config.password) ? 0x02 : 0x00;
                        const greeting = Buffer.from([0x05, 0x01, authMethod]);
                        socket.write(greeting);
                    }
                });
                let state = 'greeting';
                socket.on('data', (data) => {
                    const url = new URL(config.testUrl);
                    const targetHost = url.hostname;
                    const targetPort = parseInt(url.port) || (url.protocol === 'https:' ? 443 : 80);
                    if (config.type === 'socks4') {
                        // SOCKS4 response
                        if (data[0] === 0x00 && data[1] === 0x5a) {
                            // Success - now make HTTP request through tunnel
                            const tls = require('tls');
                            if (url.protocol === 'https:') {
                                const tlsSocket = tls.connect({
                                    socket: socket,
                                    servername: targetHost,
                                    rejectUnauthorized: false,
                                }, () => {
                                    tlsSocket.write(`GET ${url.pathname || '/'} HTTP/1.1\r\nHost: ${targetHost}\r\nConnection: close\r\n\r\n`);
                                });
                                tlsSocket.once('data', () => {
                                    clearTimeout(timeout);
                                    const responseTime = Date.now() - startTime;
                                    tlsSocket.end();
                                    resolve({
                                        success: true,
                                        tool: 'proxy',
                                        target: `${config.type}://${config.server}:${config.port}`,
                                        data: { responseTime, proxyType: config.type },
                                        timestamp: new Date().toISOString()
                                    });
                                });
                            }
                            else {
                                socket.write(`GET ${url.pathname || '/'} HTTP/1.1\r\nHost: ${targetHost}\r\nConnection: close\r\n\r\n`);
                                socket.once('data', () => {
                                    clearTimeout(timeout);
                                    const responseTime = Date.now() - startTime;
                                    socket.end();
                                    resolve({
                                        success: true,
                                        tool: 'proxy',
                                        target: `${config.type}://${config.server}:${config.port}`,
                                        data: { responseTime, proxyType: config.type },
                                        timestamp: new Date().toISOString()
                                    });
                                });
                            }
                        }
                        else {
                            clearTimeout(timeout);
                            socket.end();
                            resolve({
                                success: false,
                                tool: 'proxy',
                                target: `${config.type}://${config.server}:${config.port}`,
                                error: 'SOCKS4 connection rejected',
                                timestamp: new Date().toISOString()
                            });
                        }
                    }
                    else {
                        // SOCKS5
                        if (state === 'greeting') {
                            if (data[0] === 0x05 && data[1] === 0x02 && config.username && config.password) {
                                // Auth required
                                state = 'auth';
                                const authReq = Buffer.from([
                                    0x01,
                                    config.username.length,
                                    ...Buffer.from(config.username),
                                    config.password.length,
                                    ...Buffer.from(config.password),
                                ]);
                                socket.write(authReq);
                            }
                            else if (data[0] === 0x05 && (data[1] === 0x00 || data[1] === 0x02)) {
                                if (data[1] === 0x00) {
                                    // No auth needed, send connect
                                    state = 'connect';
                                    const hostBuffer = Buffer.from(targetHost);
                                    const connectReq = Buffer.from([
                                        0x05, 0x01, 0x00, 0x03,
                                        hostBuffer.length,
                                        ...hostBuffer,
                                        (targetPort >> 8) & 0xff, targetPort & 0xff,
                                    ]);
                                    socket.write(connectReq);
                                }
                            }
                            else {
                                clearTimeout(timeout);
                                socket.end();
                                resolve({
                                    success: false,
                                    tool: 'proxy',
                                    target: `${config.type}://${config.server}:${config.port}`,
                                    error: 'SOCKS5 auth method not supported',
                                    timestamp: new Date().toISOString()
                                });
                            }
                        }
                        else if (state === 'auth') {
                            if (data[0] === 0x01 && data[1] === 0x00) {
                                state = 'connect';
                                const hostBuffer = Buffer.from(targetHost);
                                const connectReq = Buffer.from([
                                    0x05, 0x01, 0x00, 0x03,
                                    hostBuffer.length,
                                    ...hostBuffer,
                                    (targetPort >> 8) & 0xff, targetPort & 0xff,
                                ]);
                                socket.write(connectReq);
                            }
                            else {
                                clearTimeout(timeout);
                                socket.end();
                                resolve({
                                    success: false,
                                    tool: 'proxy',
                                    target: `${config.type}://${config.server}:${config.port}`,
                                    error: 'SOCKS5 authentication failed',
                                    timestamp: new Date().toISOString()
                                });
                            }
                        }
                        else if (state === 'connect') {
                            if (data[0] === 0x05 && data[1] === 0x00) {
                                // Connected - make HTTP request
                                const tls = require('tls');
                                if (url.protocol === 'https:') {
                                    const tlsSocket = tls.connect({
                                        socket: socket,
                                        servername: targetHost,
                                        rejectUnauthorized: false,
                                    }, () => {
                                        tlsSocket.write(`GET ${url.pathname || '/'} HTTP/1.1\r\nHost: ${targetHost}\r\nConnection: close\r\n\r\n`);
                                    });
                                    tlsSocket.once('data', () => {
                                        clearTimeout(timeout);
                                        const responseTime = Date.now() - startTime;
                                        tlsSocket.end();
                                        resolve({
                                            success: true,
                                            tool: 'proxy',
                                            target: `${config.type}://${config.server}:${config.port}`,
                                            data: { responseTime, proxyType: config.type },
                                            timestamp: new Date().toISOString()
                                        });
                                    });
                                }
                                else {
                                    socket.write(`GET ${url.pathname || '/'} HTTP/1.1\r\nHost: ${targetHost}\r\nConnection: close\r\n\r\n`);
                                    socket.once('data', () => {
                                        clearTimeout(timeout);
                                        const responseTime = Date.now() - startTime;
                                        socket.end();
                                        resolve({
                                            success: true,
                                            tool: 'proxy',
                                            target: `${config.type}://${config.server}:${config.port}`,
                                            data: { responseTime, proxyType: config.type },
                                            timestamp: new Date().toISOString()
                                        });
                                    });
                                }
                            }
                            else {
                                clearTimeout(timeout);
                                socket.end();
                                resolve({
                                    success: false,
                                    tool: 'proxy',
                                    target: `${config.type}://${config.server}:${config.port}`,
                                    error: 'SOCKS5 connect failed',
                                    timestamp: new Date().toISOString()
                                });
                            }
                        }
                    }
                });
                socket.on('error', (err) => {
                    clearTimeout(timeout);
                    resolve({
                        success: false,
                        tool: 'proxy',
                        target: `${config.type}://${config.server}:${config.port}`,
                        error: err.message,
                        timestamp: new Date().toISOString()
                    });
                });
            }
        });
    }
    // Port Listener - scan local listening ports
    async getListeningPorts() {
        const platform = process.platform;
        try {
            let command;
            if (platform === 'win32') {
                command = 'netstat -ano | findstr LISTENING';
            }
            else if (platform === 'darwin') {
                command = 'lsof -iTCP -sTCP:LISTEN -P -n';
            }
            else {
                // Linux
                command = 'ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null';
            }
            const { stdout } = await execAsync(command, { timeout: 10000 });
            const ports = [];
            const lines = stdout.split('\n').filter(l => l.trim());
            if (platform === 'win32') {
                // Windows netstat format: TCP 0.0.0.0:135 0.0.0.0:0 LISTENING 1234
                for (const line of lines) {
                    const match = line.match(/^\s*(TCP|UDP)\s+(\S+):(\d+)\s+\S+\s+\S+\s+(\d+)/i);
                    if (match) {
                        ports.push({
                            protocol: match[1].toUpperCase(),
                            address: match[2],
                            port: parseInt(match[3]),
                            pid: match[4],
                        });
                    }
                }
                // Try to get process names
                try {
                    const { stdout: taskList } = await execAsync('tasklist /FO CSV /NH');
                    const processes = new Map();
                    for (const line of taskList.split('\n')) {
                        const match = line.match(/"([^"]+)","(\d+)"/);
                        if (match)
                            processes.set(match[2], match[1]);
                    }
                    for (const p of ports) {
                        if (p.pid)
                            p.process = processes.get(p.pid);
                    }
                }
                catch { }
            }
            else if (platform === 'darwin') {
                // macOS lsof format: node 1234 user 5u IPv4 0x... 0t0 TCP *:3000 (LISTEN)
                for (const line of lines.slice(1)) {
                    const parts = line.split(/\s+/);
                    if (parts.length >= 9) {
                        const addrPart = parts[8];
                        const match = addrPart.match(/([^:]+):(\d+)/);
                        if (match) {
                            ports.push({
                                protocol: 'TCP',
                                address: match[1] === '*' ? '0.0.0.0' : match[1],
                                port: parseInt(match[2]),
                                process: parts[0],
                                pid: parts[1],
                            });
                        }
                    }
                }
            }
            else {
                // Linux ss/netstat format
                for (const line of lines) {
                    // ss format: LISTEN 0 128 0.0.0.0:22 0.0.0.0:* users:(("sshd",pid=1234,fd=3))
                    const ssMatch = line.match(/^(LISTEN|UNCONN)\s+\d+\s+\d+\s+(\S+):(\d+)\s+\S+\s*(.*)/);
                    if (ssMatch) {
                        const isUdp = line.toLowerCase().includes('udp') || ssMatch[1] === 'UNCONN';
                        const processMatch = ssMatch[4]?.match(/\(\("([^"]+)",pid=(\d+)/);
                        ports.push({
                            protocol: isUdp ? 'UDP' : 'TCP',
                            address: ssMatch[2],
                            port: parseInt(ssMatch[3]),
                            process: processMatch?.[1],
                            pid: processMatch?.[2],
                        });
                    }
                    // netstat format: tcp 0 0 0.0.0.0:22 0.0.0.0:* LISTEN 1234/sshd
                    const netstatMatch = line.match(/^(tcp|udp)\S*\s+\d+\s+\d+\s+(\S+):(\d+)\s+\S+\s+\S*\s*(\d+)?\/?(\S+)?/);
                    if (netstatMatch) {
                        ports.push({
                            protocol: netstatMatch[1].toUpperCase(),
                            address: netstatMatch[2],
                            port: parseInt(netstatMatch[3]),
                            pid: netstatMatch[4],
                            process: netstatMatch[5],
                        });
                    }
                }
            }
            // Also get UDP ports on Linux/macOS
            if (platform !== 'win32') {
                try {
                    const udpCmd = platform === 'darwin'
                        ? 'lsof -iUDP -P -n'
                        : 'ss -ulnp 2>/dev/null || netstat -ulnp 2>/dev/null';
                    const { stdout: udpOut } = await execAsync(udpCmd, { timeout: 5000 });
                    for (const line of udpOut.split('\n').filter(l => l.trim())) {
                        if (platform === 'darwin') {
                            const parts = line.split(/\s+/);
                            if (parts.length >= 9 && parts[7] === 'UDP') {
                                const match = parts[8].match(/([^:]+):(\d+)/);
                                if (match) {
                                    ports.push({
                                        protocol: 'UDP',
                                        address: match[1] === '*' ? '0.0.0.0' : match[1],
                                        port: parseInt(match[2]),
                                        process: parts[0],
                                        pid: parts[1],
                                    });
                                }
                            }
                        }
                        else {
                            const ssMatch = line.match(/^UNCONN\s+\d+\s+\d+\s+(\S+):(\d+)\s+\S+\s*(.*)/);
                            if (ssMatch) {
                                const processMatch = ssMatch[3]?.match(/\(\("([^"]+)",pid=(\d+)/);
                                ports.push({
                                    protocol: 'UDP',
                                    address: ssMatch[1],
                                    port: parseInt(ssMatch[2]),
                                    process: processMatch?.[1],
                                    pid: processMatch?.[2],
                                });
                            }
                        }
                    }
                }
                catch { }
            }
            // Remove duplicates
            const unique = Array.from(new Map(ports.map(p => [`${p.protocol}:${p.address}:${p.port}`, p])).values());
            // Sort by port number
            unique.sort((a, b) => a.port - b.port);
            return {
                success: true,
                tool: 'portlistener',
                target: 'localhost',
                data: unique,
                timestamp: new Date().toISOString()
            };
        }
        catch (error) {
            return {
                success: false,
                tool: 'portlistener',
                target: 'localhost',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
}
exports.NetworkToolsService = NetworkToolsService;
exports.networkToolsService = new NetworkToolsService();
//# sourceMappingURL=NetworkToolsService.js.map