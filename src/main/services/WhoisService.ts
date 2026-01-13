const whois = require('whois');

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
   * Perform WHOIS lookup for a domain
   */
  async lookup(domain: string): Promise<{ success: boolean; result?: WhoisResult; error?: string }> {
    return new Promise((resolve) => {
      // Clean up domain
      const cleanDomain = domain.trim().toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
      
      console.log('[WhoisService] Looking up:', cleanDomain);
      
      whois.lookup(cleanDomain, (err: any, data: any) => {
        if (err) {
          console.error('[WhoisService] Lookup failed:', err);
          resolve({ success: false, error: err.message || 'Lookup failed' });
          return;
        }
        
        try {
          // Handle if data is an array (some TLDs return multiple results)
          const rawData = Array.isArray(data) ? data.map((d: any) => d.data || d).join('\n') : String(data);
          const result = this.parseWhoisData(cleanDomain, rawData);
          resolve({ success: true, result });
        } catch (parseError: any) {
          console.error('[WhoisService] Parse error:', parseError);
          const rawData = Array.isArray(data) ? data.map((d: any) => d.data || d).join('\n') : String(data);
          resolve({ 
            success: true, 
            result: { domain: cleanDomain, rawData }
          });
        }
      });
    });
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
      if (key === 'registrar' || key === 'sponsoring registrar') {
        result.registrar = value;
      }
      
      // Registrar URL
      if (key === 'registrar url' || key === 'referral url') {
        result.registrarUrl = value;
      }
      
      // Creation Date
      if (key === 'creation date' || key === 'created' || key === 'domain registration date' || key === 'registered on') {
        result.creationDate = value;
      }
      
      // Expiration Date
      if (key === 'expiration date' || key === 'expiry date' || key === 'registry expiry date' || key === 'paid-till') {
        result.expirationDate = value;
      }
      
      // Updated Date
      if (key === 'updated date' || key === 'last updated' || key === 'last modified') {
        result.updatedDate = value;
      }
      
      // Domain Status
      if (key === 'domain status' || key === 'status') {
        result.status!.push(value.split(' ')[0]); // Remove URL part
      }
      
      // Name Servers
      if (key === 'name server' || key === 'nserver') {
        result.nameServers!.push(value.toLowerCase());
      }
      
      // DNSSEC
      if (key === 'dnssec') {
        result.dnssec = value;
      }
      
      // Registrant info
      if (key === 'registrant name') {
        result.registrantName = value;
      }
      if (key === 'registrant organization' || key === 'registrant org') {
        result.registrantOrg = value;
      }
      if (key === 'registrant country') {
        result.registrantCountry = value;
      }
      
      // Admin/Tech email
      if (key === 'admin email' || key === 'administrative contact email') {
        result.adminEmail = value;
      }
      if (key === 'tech email' || key === 'technical contact email') {
        result.techEmail = value;
      }
    }

    return result;
  }
}

export const whoisService = new WhoisService();
