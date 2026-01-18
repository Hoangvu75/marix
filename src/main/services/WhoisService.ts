import * as net from 'net';
import * as https from 'https';
import { WHOIS_SERVERS, WHOIS_PORT, WHOIS_TIMEOUT, GOOGLE_RDAP_TLDS } from './whois-servers';

interface WhoisResult {
  domain: string;
  registrar?: string;
  registrarUrl?: string;
  creationDate?: string;
  expirationDate?: string;
  updatedDate?: string;
  status?: string[];
  nameServers?: string[];
  dnssec?: string;
  registrantName?: string;
  registrantOrg?: string;
  registrantCountry?: string;
  adminEmail?: string;
  techEmail?: string;
  rawData: string;
}

export class WhoisService {
  /**
   * Get the TLD from a domain
   */
  private getTLD(domain: string): string {
    const parts = domain.split('.');
    if (parts.length < 2) return '';
    
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
  private isGoogleRdapTld(tld: string): boolean {
    return GOOGLE_RDAP_TLDS.has(tld.toLowerCase());
  }

  /**
   * Query Google RDAP API
   */
  private async queryGoogleRdap(domain: string): Promise<WhoisResult> {
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
          } catch (err) {
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
  private formatRdapAsText(domain: string, rdap: any, result: WhoisResult): string {
    const lines: string[] = [];
    
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
  private parseRdapData(domain: string, rdap: any): WhoisResult {
    const result: WhoisResult = {
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
      result.status = rdap.status.map((s: string) => s.replace(/ /g, ''));
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
        .map((ns: any) => ns.ldhName?.toLowerCase())
        .filter((ns: string) => ns);
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
            const fnEntry = vcard.find((v: any) => v[0] === 'fn');
            if (fnEntry) {
              result.registrar = fnEntry[3];
            }
          }
          
          // Get registrar URL from links
          if (entity.links && Array.isArray(entity.links)) {
            const aboutLink = entity.links.find((l: any) => l.rel === 'about');
            if (aboutLink) {
              result.registrarUrl = aboutLink.href;
            }
          }

          // Check for abuse contact in nested entities
          if (entity.entities && Array.isArray(entity.entities)) {
            for (const subEntity of entity.entities) {
              if (subEntity.roles?.includes('abuse') && subEntity.vcardArray?.[1]) {
                const vcard = subEntity.vcardArray[1];
                const emailEntry = vcard.find((v: any) => v[0] === 'email');
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
          const fnEntry = vcard.find((v: any) => v[0] === 'fn');
          const orgEntry = vcard.find((v: any) => v[0] === 'org');
          
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
  private getWhoisServer(domain: string): string {
    const tld = this.getTLD(domain);
    return WHOIS_SERVERS[tld] || 'whois.iana.org';
  }

  /**
   * Query a WHOIS server directly using TCP socket
   */
  private async queryWhoisServer(server: string, domain: string): Promise<string> {
    return new Promise((resolve, reject) => {
      let data = '';
      
      const socket = new net.Socket();
      socket.setTimeout(WHOIS_TIMEOUT);
      
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
      
      socket.connect(WHOIS_PORT, server);
    });
  }

  /**
   * Lookup domain WHOIS information
   */
  async lookup(domain: string): Promise<{ success: boolean; result?: WhoisResult; error?: string }> {
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
        } catch (refErr) {
          console.warn('[WhoisService] Referral query failed:', refErr);
        }
      }
      
      const result = this.parseWhoisData(cleanDomain, rawData);
      return { success: true, result };
      
    } catch (error: any) {
      console.error('[WhoisService] Lookup failed:', error);
      return { success: false, error: error.message || 'Lookup failed' };
    }
  }

  /**
   * Parse raw WHOIS data into structured format
   */
  private parseWhoisData(domain: string, rawData: string): WhoisResult {
    const result: WhoisResult = {
      domain,
      rawData,
      status: [],
      nameServers: [],
    };

    const lines = rawData.split('\n');
    
    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;
      
      const key = line.substring(0, colonIndex).trim().toLowerCase();
      const value = line.substring(colonIndex + 1).trim();
      
      if (!value) continue;

      // Registrar
      if (key === 'registrar' || key === 'registrar name' || key === 'sponsoring registrar') {
        if (!result.registrar) result.registrar = value;
      }
      
      // Registrar URL
      if (key === 'registrar url' || key === 'registrar-url') {
        result.registrarUrl = value;
      }
      
      // Creation date
      if (key === 'creation date' || key === 'created' || key === 'created date' || 
          key === 'registration date' || key === 'domain registration date' ||
          key === 'created on' || key === 'registered on' || key === 'registered') {
        if (!result.creationDate) result.creationDate = value;
      }
      
      // Expiration date
      if (key === 'registry expiry date' || key === 'registrar registration expiration date' ||
          key === 'expiration date' || key === 'expiry date' || key === 'expires' ||
          key === 'expires on' || key === 'paid-till' || key === 'expiry') {
        if (!result.expirationDate) result.expirationDate = value;
      }
      
      // Updated date
      if (key === 'updated date' || key === 'last updated' || key === 'last modified' ||
          key === 'modified' || key === 'changed' || key === 'last update') {
        if (!result.updatedDate) result.updatedDate = value;
      }
      
      // Status
      if (key === 'domain status' || key === 'status') {
        const statusValue = value.split(' ')[0]; // Remove URL after status
        if (statusValue && !result.status!.includes(statusValue)) {
          result.status!.push(statusValue);
        }
      }
      
      // Nameservers
      if (key === 'name server' || key === 'nameserver' || key === 'nserver' || key === 'ns') {
        const ns = value.toLowerCase().split(' ')[0];
        if (ns && !result.nameServers!.includes(ns)) {
          result.nameServers!.push(ns);
        }
      }
      
      // DNSSEC
      if (key === 'dnssec') {
        result.dnssec = value;
      }
      
      // Registrant
      if (key === 'registrant name' || key === 'registrant') {
        if (!result.registrantName) result.registrantName = value;
      }
      if (key === 'registrant organization' || key === 'registrant org') {
        if (!result.registrantOrg) result.registrantOrg = value;
      }
      if (key === 'registrant country' || key === 'registrant country/economy') {
        if (!result.registrantCountry) result.registrantCountry = value;
      }
      
      // Admin email
      if (key === 'admin email' || key === 'administrative contact email' || key === 'registrar abuse contact email') {
        if (!result.adminEmail) result.adminEmail = value;
      }
      
      // Tech email
      if (key === 'tech email' || key === 'technical contact email') {
        if (!result.techEmail) result.techEmail = value;
      }
    }

    return result;
  }
}

export const whoisService = new WhoisService();
