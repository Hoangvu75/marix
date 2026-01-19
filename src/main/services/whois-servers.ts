/**
 * WHOIS Server List by TLD
 * 
 * This file contains WHOIS servers as FALLBACK only.
 * The WhoisService first checks IANA Bootstrap Registry for RDAP support.
 * If RDAP is available, it will be used instead of traditional WHOIS.
 * 
 * Most gTLDs now support RDAP and are handled automatically via:
 * https://data.iana.org/rdap/dns.json
 * 
 * This file only contains ccTLDs and TLDs that may not have RDAP support.
 */

// Google Registry TLDs - prioritized for direct Google RDAP API
// (IANA Bootstrap also has these, but Google's API is faster)
export const GOOGLE_RDAP_TLDS = new Set([
  'dev', 'app', 'page', 'new', 'foo', 'soy', 'how', 'day', 'rsvp',
  'google', 'gmail', 'youtube', 'docs', 'drive', 'meet', 'play',
  'android', 'chrome', 'nexus', 'gle', 'channel',
  'phd', 'prof', 'esq', 'mov', 'zip', 'dad', 'ing', 'meme',
  'boo', 'cal', 'dclk', 'eat', 'fly', 'gbiz', 'goog', 'guge',
  'hangout', 'here', 'map', 'prod', 'search'
]);

// Helper function to create server mapping from grouped TLDs
function createServerMap(groups: { [server: string]: string[] }): { [tld: string]: string } {
  const map: { [tld: string]: string } = {};
  for (const [server, tlds] of Object.entries(groups)) {
    for (const tld of tlds) {
      map[tld] = server;
    }
  }
  return map;
}

// WHOIS servers for TLDs that may not have RDAP or as fallback
// Note: IANA Bootstrap is checked first, these are fallbacks
const GROUPED_SERVERS = {
  // Russia (no RDAP)
  'whois.tcinet.ru': ['ru', 'su'],
  
  // France territories (some may not have RDAP)
  'whois.mediaserv.net': ['gf', 'mq'],
  
  // Sweden
  'whois.iis.se': ['se'],
  'whois.iis.nu': ['nu'],
};

// ccTLDs that may not have RDAP support (fallback only)
// Most ccTLDs now have RDAP via IANA Bootstrap
const INDIVIDUAL_SERVERS: { [tld: string]: string } = {
  // These ccTLDs may not be in IANA Bootstrap or have unreliable RDAP
  'ae': 'whois.aeda.net.ae',
  'af': 'whois.nic.af',
  'am': 'whois.amnic.net',
  'aw': 'whois.nic.aw',
  'ax': 'whois.ax',
  'bg': 'whois.register.bg',
  'bi': 'whois1.nic.bi',
  'bj': 'whois.nic.bj',
  'bn': 'whois.bn',
  'bo': 'whois.nic.bo',
  'by': 'whois.cctld.by',
  'bz': 'whois.belizenic.bz',
  'cd': 'whois.nic.cd',
  'ch': 'whois.nic.ch',
  'ci': 'whois.nic.ci',
  'ck': 'whois.nic.ck',
  'cn': 'whois.cnnic.cn',
  'de': 'whois.denic.de',
  'dk': 'whois.dk-hostmaster.dk',
  'dm': 'whois.nic.dm',
  'do': 'whois.nic.do',
  'dz': 'whois.nic.dz',
  'eg': 'whois.ripe.net',
  'es': 'whois.nic.es',
  'eu': 'whois.eu',
  'ga': 'whois.my.ga',
  'ge': 'whois.nic.ge',
  'gg': 'whois.gg',
  'gl': 'whois.nic.gl',
  'gp': 'whois.nic.gp',
  'gr': 'grweb.ics.forth.gr',
  'hk': 'whois.hkirc.hk',
  'hr': 'whois.dns.hr',
  'hu': 'whois.nic.hu',
  'ie': 'whois.iedr.ie',
  'il': 'whois.isoc.org.il',
  'im': 'whois.nic.im',
  'iq': 'whois.cmc.iq',
  'ir': 'whois.nic.ir',
  'it': 'whois.nic.it',
  'je': 'whois.je',
  'jp': 'whois.jprs.jp',
  'ki': 'whois.nic.ki',
  'kr': 'whois.kr',
  'kw': 'whois.nic.kw',
  'kz': 'whois.nic.kz',
  'la': 'whois.nic.la',
  'li': 'whois.nic.li',
  'lk': 'whois.nic.lk',
  'lt': 'whois.domreg.lt',
  'lu': 'whois.dns.lu',
  'lv': 'whois.nic.lv',
  'ma': 'whois.registre.ma',
  'md': 'whois.nic.md',
  'me': 'whois.nic.me',
  'mk': 'whois.marnet.mk',
  'mn': 'whois.nic.mn',
  'mo': 'whois.monic.mo',
  'mp': 'whois.nic.mp',
  'mr': 'whois.nic.mr',
  'mv': 'whois.mv',
  'mw': 'whois.nic.mw',
  'mx': 'whois.mx',
  'my': 'whois.mynic.my',
  'mz': 'whois.nic.mz',
  'nc': 'whois.nc',
  'ng': 'whois.nic.net.ng',
  'om': 'whois.registry.om',
  'pe': 'kero.yachay.pe',
  'pf': 'whois.registry.pf',
  'pk': 'whois.pknic.net.pk',
  'pr': 'whois.nic.pr',
  'ps': 'whois.pnina.ps',
  'pt': 'whois.dns.pt',
  'qa': 'whois.registry.qa',
  'ro': 'whois.rotld.ro',
  'rs': 'whois.rnids.rs',
  'sa': 'whois.nic.net.sa',
  'sb': 'whois.nic.net.sb',
  'sc': 'whois.nic.sc',
  'sg': 'whois.sgnic.sg',
  'sh': 'whois.nic.sh',
  'sk': 'whois.sk-nic.sk',
  'sl': 'whois.nic.sl',
  'sm': 'whois.nic.sm',
  'sn': 'whois.nic.sn',
  'so': 'whois.nic.so',
  'st': 'whois.nic.st',
  'sv': 'whois.svnet.sv',
  'sx': 'whois.sx',
  'sy': 'whois.tld.sy',
  'tc': 'whois.nic.tc',
  'td': 'whois.nic.td',
  'tg': 'whois.nic.tg',
  'tj': 'whois.nic.tj',
  'tk': 'whois.dot.tk',
  'tl': 'whois.nic.tl',
  'tm': 'whois.nic.tm',
  'tn': 'whois.ati.tn',
  'tr': 'whois.trabis.gov.tr',
  'ug': 'whois.co.ug',
  'us': 'whois.nic.us',
  'uy': 'whois.nic.org.uy',
  've': 'whois.nic.ve',
  'vn': 'whois.vnnic.vn',
  'vu': 'whois.dnrs.vu',
  'ws': 'whois.website.ws',
  'za': 'whois.registry.net.za',

  // Legacy gTLDs that may need fallback (most have RDAP now)
  'edu': 'whois.educause.edu',
  'mil': 'whois.nic.mil',
};

// Merge grouped and individual servers
export const WHOIS_SERVERS: { [tld: string]: string } = {
  ...createServerMap(GROUPED_SERVERS),
  ...INDIVIDUAL_SERVERS,
};

// Default WHOIS port
export const WHOIS_PORT = 43;

// Connection timeout in milliseconds  
export const WHOIS_TIMEOUT = 15000;
