import { promisify } from 'node:util';
import dns from 'node:dns';

// Convert dns methods to promise-based
const resolve4 = promisify(dns.resolve4);
const resolve6 = promisify(dns.resolve6);
const resolveMx = promisify(dns.resolveMx);
const resolveNs = promisify(dns.resolveNs);
const resolveTxt = promisify(dns.resolveTxt);
const resolveCname = promisify(dns.resolveCname);
const resolveSoa = promisify(dns.resolveSoa);
const reverse = promisify(dns.reverse);

export interface DNSInfo {
  domain: string;
  records: {
    A?: string[];
    AAAA?: string[];
    MX?: Array<{ exchange: string; priority: number }>;
    NS?: string[];
    TXT?: string[];
    CNAME?: string[];
    SOA?: {
      nsname: string;
      hostmaster: string;
      serial: number;
      refresh: number;
      retry: number;
      expire: number;
      minttl: number;
    };
    PTR?: string[];
  };
  errors?: string[];
  lookupTime: number;
}

export async function getDNSInfo(domain: string): Promise<DNSInfo> {
  const startTime = Date.now();
  const dnsInfo: DNSInfo = {
    domain,
    records: {},
    errors: [],
    lookupTime: 0,
  };

  try {
    // A records (IPv4)
    try {
      dnsInfo.records.A = await resolve4(domain);
    } catch (error: any) {
      dnsInfo.errors?.push(`A record lookup failed: ${error.message}`);
    }

    // AAAA records (IPv6)
    try {
      dnsInfo.records.AAAA = await resolve6(domain);
    } catch (error: any) {
      dnsInfo.errors?.push(`AAAA record lookup failed: ${error.message}`);
    }

    // MX records (Mail Exchange)
    try {
      dnsInfo.records.MX = await resolveMx(domain);
    } catch (error: any) {
      dnsInfo.errors?.push(`MX record lookup failed: ${error.message}`);
    }

    // NS records (Name Servers)
    try {
      dnsInfo.records.NS = await resolveNs(domain);
    } catch (error: any) {
      dnsInfo.errors?.push(`NS record lookup failed: ${error.message}`);
    }

    // TXT records
    try {
      const txtRecords = await resolveTxt(domain);
      dnsInfo.records.TXT = txtRecords.flat(); // Flatten array of arrays
    } catch (error: any) {
      dnsInfo.errors?.push(`TXT record lookup failed: ${error.message}`);
    }

    // CNAME record
    try {
      const cname = await resolveCname(domain);
      dnsInfo.records.CNAME = cname;
    } catch (error: any) {
      // CNAME lookup often fails for domains that aren't aliases, so don't treat this as a critical error
      if (!error.message.includes('ENOTFOUND')) {
        dnsInfo.errors?.push(`CNAME record lookup failed: ${error.message}`);
      }
    }

    // SOA record (Start of Authority)
    try {
      dnsInfo.records.SOA = await resolveSoa(domain);
    } catch (error: any) {
      dnsInfo.errors?.push(`SOA record lookup failed: ${error.message}`);
    }

    // PTR records (reverse DNS) - try for A records
    if (dnsInfo.records.A && dnsInfo.records.A.length > 0) {
      try {
        const ptrResults: string[] = [];
        for (const ip of dnsInfo.records.A.slice(0, 3)) {
          // Limit to first 3 IPs to avoid too many lookups
          try {
            const ptr = await reverse(ip);
            ptrResults.push(...ptr);
          } catch (ptrError: any) {
            // PTR lookup failures are common, don't add to errors
          }
        }
        if (ptrResults.length > 0) {
          dnsInfo.records.PTR = [...new Set(ptrResults)]; // Remove duplicates
        }
      } catch (error: any) {
        // Don't add PTR errors as they're expected for many IPs
      }
    }
  } catch (error: any) {
    dnsInfo.errors?.push(`DNS lookup failed: ${error.message}`);
  }

  dnsInfo.lookupTime = Date.now() - startTime;
  return dnsInfo;
}

// Function to get basic DNS info quickly (just A and AAAA records)
export async function getBasicDNSInfo(domain: string): Promise<DNSInfo> {
  const startTime = Date.now();
  const dnsInfo: DNSInfo = {
    domain,
    records: {},
    errors: [],
    lookupTime: 0,
  };

  try {
    // A records (IPv4)
    try {
      dnsInfo.records.A = await resolve4(domain);
    } catch (error: any) {
      dnsInfo.errors?.push(`A record lookup failed: ${error.message}`);
    }

    // AAAA records (IPv6)
    try {
      dnsInfo.records.AAAA = await resolve6(domain);
    } catch (error: any) {
      dnsInfo.errors?.push(`AAAA record lookup failed: ${error.message}`);
    }
  } catch (error: any) {
    dnsInfo.errors?.push(`Basic DNS lookup failed: ${error.message}`);
  }

  dnsInfo.lookupTime = Date.now() - startTime;
  return dnsInfo;
}
