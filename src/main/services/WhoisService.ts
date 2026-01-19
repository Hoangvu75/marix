import * as net from 'net';
import * as https from 'https';
import * as http from 'http';
import { WHOIS_SERVERS, WHOIS_PORT, WHOIS_TIMEOUT, GOOGLE_RDAP_TLDS } from './whois-servers';

// Contact information structure (for registrant, admin, tech contacts)
interface ContactInfo {
  name?: string;
  organization?: string;
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  fax?: string;
  email?: string;
}

interface WhoisResult {
  domain: string;
  registrar?: string;
  registrarUrl?: string;
  registrarIanaId?: string;
  registrarAbuseEmail?: string;
  registrarAbusePhone?: string;
  creationDate?: string;
  expirationDate?: string;
  updatedDate?: string;
  status?: string[];
  nameServers?: string[];
  dnssec?: string;
  // Contact information
  registrant?: ContactInfo;
  admin?: ContactInfo;
  tech?: ContactInfo;
  billing?: ContactInfo;
  // Legacy fields (for backward compatibility)
  registrantName?: string;
  registrantOrg?: string;
  registrantCountry?: string;
  adminEmail?: string;
  techEmail?: string;
  rawData: string;
}

// IANA Bootstrap Registry cache
interface BootstrapRegistry {
  services: [string[], string[]][];  // [[tlds], [rdap_urls]]
  lastFetch: number;
}

// Cache duration: 24 hours
const BOOTSTRAP_CACHE_TTL = 24 * 60 * 60 * 1000;
const IANA_BOOTSTRAP_URL = 'https://data.iana.org/rdap/dns.json';

export class WhoisService {
  private bootstrapCache: BootstrapRegistry | null = null;

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
   * Check if TLD uses Google RDAP (always prioritize Google's fast API)
   */
  private isGoogleRdapTld(tld: string): boolean {
    return GOOGLE_RDAP_TLDS.has(tld.toLowerCase());
  }

  /**
   * Fetch IANA Bootstrap Registry for RDAP servers
   */
  private async fetchBootstrapRegistry(): Promise<void> {
    // Return cached if still valid
    if (this.bootstrapCache && (Date.now() - this.bootstrapCache.lastFetch) < BOOTSTRAP_CACHE_TTL) {
      return;
    }

    console.log('[WhoisService] Fetching IANA Bootstrap Registry...');
    
    return new Promise((resolve, reject) => {
      const req = https.get(IANA_BOOTSTRAP_URL, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Marix-SSH-Client/1.0'
        },
        timeout: 15000
      }, (res) => {
        let data = '';
        
        res.on('data', (chunk) => data += chunk);
        
        res.on('end', () => {
          if (res.statusCode !== 200) {
            console.warn('[WhoisService] Failed to fetch bootstrap registry:', res.statusCode);
            resolve(); // Don't fail, just continue without bootstrap
            return;
          }
          
          try {
            const json = JSON.parse(data);
            this.bootstrapCache = {
              services: json.services || [],
              lastFetch: Date.now()
            };
            console.log('[WhoisService] Bootstrap registry loaded with', this.bootstrapCache.services.length, 'services');
            resolve();
          } catch (err) {
            console.warn('[WhoisService] Failed to parse bootstrap registry:', err);
            resolve();
          }
        });
      });

      req.on('error', (err) => {
        console.warn('[WhoisService] Bootstrap registry fetch error:', err);
        resolve(); // Don't fail, just continue without bootstrap
      });

      req.on('timeout', () => {
        req.destroy();
        console.warn('[WhoisService] Bootstrap registry fetch timeout');
        resolve();
      });
    });
  }

  /**
   * Get RDAP URL for a TLD from IANA Bootstrap Registry
   */
  private getRdapUrlFromBootstrap(tld: string): string | null {
    if (!this.bootstrapCache) return null;

    const normalizedTld = tld.toLowerCase();
    
    for (const [tlds, urls] of this.bootstrapCache.services) {
      if (tlds.some(t => t.toLowerCase() === normalizedTld)) {
        // Prefer HTTPS URL
        const httpsUrl = urls.find(u => u.startsWith('https://'));
        const url = httpsUrl || urls[0];
        // Ensure trailing slash
        return url.endsWith('/') ? url : url + '/';
      }
    }
    
    return null;
  }

  /**
   * Check if a TLD has RDAP support via IANA Bootstrap
   */
  private async hasRdapSupport(tld: string): Promise<string | null> {
    // Always prefer Google RDAP for Google-managed TLDs
    if (this.isGoogleRdapTld(tld)) {
      return 'https://pubapi.registry.google/rdap/';
    }

    // Check IANA Bootstrap registry
    await this.fetchBootstrapRegistry();
    return this.getRdapUrlFromBootstrap(tld);
  }

  /**
   * Generic HTTPS GET request for RDAP
   */
  private async fetchRdap(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      console.log('[WhoisService] Fetching RDAP:', url);
      
      const parsedUrl = new URL(url);
      const options = {
        hostname: parsedUrl.hostname,
        port: 443,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
          'Accept': 'application/rdap+json, application/json',
          'User-Agent': 'Marix-SSH-Client/1.0'
        },
        timeout: 15000
      };

      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new Error(`RDAP returned status ${res.statusCode}`));
            return;
          }
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(new Error('Failed to parse RDAP response'));
          }
        });
      });

      req.on('error', (err) => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('RDAP request timeout'));
      });
      
      req.end();
    });
  }

  /**
   * Find registrar RDAP URL from RDAP response
   */
  private findRegistrarRdapUrl(rdap: any, domain: string): string | null {
    // Method 1: Check links array for 'related' type (standard RDAP referral)
    if (rdap.links && Array.isArray(rdap.links)) {
      for (const link of rdap.links) {
        if (link.rel === 'related' && link.type === 'application/rdap+json' && link.href) {
          console.log('[WhoisService] Found related link referral:', link.href);
          return link.href;
        }
      }
    }

    // Method 2: Check registrar entity for RDAP link (common pattern)
    if (rdap.entities && Array.isArray(rdap.entities)) {
      for (const entity of rdap.entities) {
        if (entity.roles?.includes('registrar') && entity.links) {
          for (const link of entity.links) {
            // Look for 'about' link which typically points to registrar's RDAP service
            if (link.rel === 'about' && link.href) {
              const baseUrl = link.href.replace(/\/$/, '');
              // Construct domain lookup URL
              const domainUrl = `${baseUrl}/domain/${domain}`;
              console.log('[WhoisService] Constructed registrar RDAP URL from entity:', domainUrl);
              return domainUrl;
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * Query RDAP API with optional registrar follow (works for any RDAP server)
   */
  private async queryRdap(domain: string, rdapBaseUrl: string): Promise<WhoisResult> {
    // Ensure proper URL format
    const baseUrl = rdapBaseUrl.endsWith('/') ? rdapBaseUrl : rdapBaseUrl + '/';
    const url = `${baseUrl}domain/${domain}`;
    console.log('[WhoisService] Using RDAP:', url);
    
    // Fetch registry RDAP
    const registryRdap = await this.fetchRdap(url);
    
    // Try to get registrar RDAP for more detailed info (follow referral)
    let registrarRdap: any = null;
    const registrarUrl = this.findRegistrarRdapUrl(registryRdap, domain);
    
    if (registrarUrl) {
      console.log('[WhoisService] Following referral to registrar RDAP:', registrarUrl);
      try {
        registrarRdap = await this.fetchRdap(registrarUrl);
        console.log('[WhoisService] Got registrar RDAP response');
      } catch (err) {
        console.warn('[WhoisService] Failed to fetch registrar RDAP:', err);
        // Continue with registry data only
      }
    }
    
    // Parse and merge data (registrar data takes precedence)
    const result = this.parseRdapData(domain, registrarRdap || registryRdap, registryRdap, registrarRdap);
    return result;
  }

  /**
   * Format RDAP data as readable text (like traditional WHOIS)
   */
  private formatRdapAsText(domain: string, rdap: any, result: WhoisResult, registryRdap?: any, registrarRdap?: any): string {
    const lines: string[] = [];
    
    lines.push('Domain Name: ' + (rdap.ldhName || domain).toUpperCase());
    lines.push('Registry Domain ID: ' + (rdap.handle || 'N/A'));
    
    // Registrar information
    if (result.registrar) {
      lines.push('Registrar: ' + result.registrar);
    }
    if (result.registrarIanaId) {
      lines.push('Registrar IANA ID: ' + result.registrarIanaId);
    }
    if (result.registrarUrl) {
      lines.push('Registrar URL: ' + result.registrarUrl);
    }
    if (result.registrarAbuseEmail) {
      lines.push('Registrar Abuse Contact Email: ' + result.registrarAbuseEmail);
    }
    if (result.registrarAbusePhone) {
      lines.push('Registrar Abuse Contact Phone: ' + result.registrarAbusePhone);
    }
    
    // Add WHOIS server if available
    if (rdap.port43) {
      lines.push('Registrar WHOIS Server: ' + rdap.port43);
    }
    
    lines.push('');
    
    // Dates
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
    
    // Status
    if (result.status && result.status.length > 0) {
      for (const status of result.status) {
        lines.push('Domain Status: ' + status);
      }
    }
    
    lines.push('');
    
    // Nameservers
    if (result.nameServers && result.nameServers.length > 0) {
      for (const ns of result.nameServers) {
        lines.push('Name Server: ' + ns.toUpperCase());
      }
    }
    
    lines.push('');
    
    // DNSSEC
    if (result.dnssec) {
      lines.push('DNSSEC: ' + result.dnssec);
    }
    
    // Registrant contact
    if (result.registrant) {
      lines.push('');
      lines.push('--- Registrant Contact ---');
      this.formatContact(lines, 'Registrant', result.registrant);
    }
    
    // Admin contact
    if (result.admin) {
      lines.push('');
      lines.push('--- Administrative Contact ---');
      this.formatContact(lines, 'Admin', result.admin);
    }
    
    // Tech contact
    if (result.tech) {
      lines.push('');
      lines.push('--- Technical Contact ---');
      this.formatContact(lines, 'Tech', result.tech);
    }
    
    // Billing contact
    if (result.billing) {
      lines.push('');
      lines.push('--- Billing Contact ---');
      this.formatContact(lines, 'Billing', result.billing);
    }
    
    lines.push('');
    lines.push('>>> Last update of RDAP database: ' + new Date().toISOString() + ' <<<');
    
    // Add source information
    lines.push('');
    if (registrarRdap) {
      lines.push('--- Data Source: Registrar RDAP ---');
      if (registrarRdap.port43) {
        lines.push('Registrar WHOIS Server: ' + registrarRdap.port43);
      }
    } else if (registryRdap) {
      lines.push('--- Data Source: Registry RDAP ---');
    }
    
    lines.push('');
    lines.push('For more information on RDAP, please see https://about.rdap.org');
    
    return lines.join('\n');
  }

  /**
   * Format a contact section for text output
   */
  private formatContact(lines: string[], prefix: string, contact: ContactInfo): void {
    if (contact.name) {
      lines.push(`${prefix} Name: ${contact.name}`);
    }
    if (contact.organization) {
      lines.push(`${prefix} Organization: ${contact.organization}`);
    }
    if (contact.street) {
      lines.push(`${prefix} Street: ${contact.street}`);
    }
    if (contact.city) {
      lines.push(`${prefix} City: ${contact.city}`);
    }
    if (contact.state) {
      lines.push(`${prefix} State/Province: ${contact.state}`);
    }
    if (contact.postalCode) {
      lines.push(`${prefix} Postal Code: ${contact.postalCode}`);
    }
    if (contact.country) {
      lines.push(`${prefix} Country: ${contact.country}`);
    }
    if (contact.phone) {
      lines.push(`${prefix} Phone: ${contact.phone}`);
    }
    if (contact.fax) {
      lines.push(`${prefix} Fax: ${contact.fax}`);
    }
    if (contact.email) {
      lines.push(`${prefix} Email: ${contact.email}`);
    }
  }

  /**
   * Parse RDAP JSON response into WhoisResult
   */
  private parseRdapData(domain: string, rdap: any, registryRdap?: any, registrarRdap?: any): WhoisResult {
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
          case 'registrar expiration':  // Amazon Registrar uses this
            if (!result.expirationDate) {
              result.expirationDate = event.eventDate;
            }
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

    // Entities (registrar, registrant, admin, tech, billing)
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
            // Get registrar email
            const emailEntry = vcard.find((v: any) => v[0] === 'email');
            if (emailEntry) {
              result.registrarAbuseEmail = emailEntry[3];
            }
          }
          
          // Get IANA ID from publicIds
          if (entity.publicIds && Array.isArray(entity.publicIds)) {
            const ianaId = entity.publicIds.find((p: any) => p.type === 'IANA Registrar ID');
            if (ianaId) {
              result.registrarIanaId = ianaId.identifier;
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
                const telEntry = vcard.find((v: any) => v[0] === 'tel');
                if (emailEntry) {
                  result.registrarAbuseEmail = emailEntry[3];
                }
                if (telEntry) {
                  // tel can be uri format like "tel:+1.2024422253"
                  const phone = telEntry[3]?.replace(/^tel:/, '') || telEntry[3];
                  result.registrarAbusePhone = phone;
                }
              }
            }
          }
        }

        // Parse contact info for registrant, admin, tech, billing
        if (roles.includes('registrant')) {
          result.registrant = this.parseVcardToContact(entity.vcardArray);
          // Legacy fields for backward compatibility
          result.registrantName = result.registrant?.name;
          result.registrantOrg = result.registrant?.organization;
          result.registrantCountry = result.registrant?.country;
        }
        
        if (roles.includes('administrative')) {
          result.admin = this.parseVcardToContact(entity.vcardArray);
          result.adminEmail = result.admin?.email;
        }
        
        if (roles.includes('technical')) {
          result.tech = this.parseVcardToContact(entity.vcardArray);
          result.techEmail = result.tech?.email;
        }
        
        if (roles.includes('billing')) {
          result.billing = this.parseVcardToContact(entity.vcardArray);
        }
      }
    }

    // Format rawData as readable text instead of JSON
    result.rawData = this.formatRdapAsText(domain, rdap, result, registryRdap, registrarRdap);

    return result;
  }

  /**
   * Parse vCard array into ContactInfo structure
   */
  private parseVcardToContact(vcardArray: any): ContactInfo | undefined {
    if (!vcardArray || !vcardArray[1]) return undefined;
    
    const vcard = vcardArray[1];
    const contact: ContactInfo = {};
    
    for (const entry of vcard) {
      if (!Array.isArray(entry) || entry.length < 4) continue;
      
      const [type, params, , value] = entry;
      
      switch (type) {
        case 'fn':
          contact.name = value;
          break;
        case 'org':
          contact.organization = value;
          break;
        case 'adr':
          // adr format: ["adr", {cc:"XX"}, "text", [pobox, ext, street, city, region, postal, country]]
          // or sometimes just ["adr", {cc:"XX"}, "text", ["","","street","city","region","postal",""]]
          if (Array.isArray(value)) {
            // Standard vCard 4.0 format: [pobox, ext, street, locality, region, postal, country]
            contact.street = value[2] || undefined;
            contact.city = value[3] || undefined;
            contact.state = value[4] || undefined;
            contact.postalCode = value[5] || undefined;
            contact.country = value[6] || undefined;
            // If country is empty but we have cc in params, use that
            if (!contact.country && params?.cc) {
              contact.country = params.cc;
            }
          }
          break;
        case 'tel':
          // tel can be "uri" type like "tel:+1.234567890" or direct value
          const phone = typeof value === 'string' ? value.replace(/^tel:/, '') : value;
          // Check if it's voice or fax
          const telType = params?.type;
          if (Array.isArray(telType) && telType.includes('fax')) {
            contact.fax = phone;
          } else {
            contact.phone = phone;
          }
          break;
        case 'email':
          contact.email = value;
          break;
        case 'contact-uri':
          // contact-uri is often used for privacy-protected emails
          // e.g., "mailto:abc@identity-protect.org"
          if (!contact.email && typeof value === 'string') {
            contact.email = value.replace(/^mailto:/, '');
          }
          break;
      }
    }
    
    return Object.keys(contact).length > 0 ? contact : undefined;
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
      
      // Check if this TLD has RDAP support (via IANA Bootstrap or Google)
      const rdapBaseUrl = await this.hasRdapSupport(tld);
      
      if (rdapBaseUrl) {
        console.log('[WhoisService] Using RDAP for TLD:', tld, '- Base URL:', rdapBaseUrl);
        try {
          const result = await this.queryRdap(cleanDomain, rdapBaseUrl);
          return { success: true, result };
        } catch (rdapErr: any) {
          console.warn('[WhoisService] RDAP query failed, falling back to WHOIS:', rdapErr.message);
          // Fall through to WHOIS
        }
      }
      
      // Traditional WHOIS query (fallback or for TLDs without RDAP)
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
