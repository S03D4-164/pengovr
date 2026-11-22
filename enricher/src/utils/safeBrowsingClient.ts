/**
 * Safe Browsing v5 API Client
 * Improved Protobuf parsing with dedicated decoder class
 */
import { ProtobufDecoder } from './protobufDecoder.js';
import Redis from 'ioredis';

interface ThreatMatch {
  threatType: string;
  listName: string;
  cacheDuration?: string;
  fullHash?: string; // Base64-encoded full hash
  fullHashDetails?: Array<{ threatType: string }>; // Details from FullHashDetail
}

interface ThreatInfo {
  threatMatches?: ThreatMatch[];
  error?: string;
}

// Enum mapping for better readability
const THREAT_TYPE_MAP: { [key: number]: string } = {
  0: 'THREAT_TYPE_UNSPECIFIED',
  1: 'MALWARE',
  2: 'SOCIAL_ENGINEERING',
  3: 'UNWANTED_SOFTWARE',
  4: 'POTENTIALLY_HARMFUL_APPLICATION',
  5: 'SOCIAL_ENGINEERING_EXTENDED_COVERAGE',
};

class SafeBrowsingClient {
  private apiKey: string;
  private baseUrl: string = 'https://safebrowsing.googleapis.com/v5';
  private redisClient: Redis | null = null;
  private timeout: number = 10000;
  private cachePrefix: string = 'gosb:hash:';

  constructor(apiKey: string, redisClient?: Redis) {
    if (!apiKey) {
      throw new Error('Google Safe Browsing API key is required');
    }
    this.apiKey = apiKey;
    this.redisClient = redisClient || null;
  }

  /**
   * Initialize - connect to Redis
   */
  async initialize(): Promise<void> {
    if (!process.env.REDIS_HOST) {
      console.warn('REDIS_HOST not set, using in-memory cache only');
      return;
    }

    try {
      this.redisClient = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
        retryStrategy: (times) => Math.min(times * 50, 2000),
      });

      this.redisClient.on('error', (err) =>
        console.log('Redis Client Error', err),
      );

      await this.redisClient.ping();
      console.log('Redis client connected');
    } catch (error: any) {
      console.warn('Failed to connect to Redis:', error.message);
      this.redisClient = null;
    }
  }

  /**
   * Get cached result from Redis
   */
  private async getCached(key: string): Promise<any[] | null> {
    if (!this.redisClient) {
      return null;
    }

    try {
      const cached = await this.redisClient.get(this.cachePrefix + key);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error: any) {
      console.warn('Cache get error:', error.message);
    }

    return null;
  }

  /**
   * Set cache in Redis
   */
  private async setCached(
    key: string,
    value: any[],
    ttlSeconds: number,
  ): Promise<void> {
    if (!this.redisClient) {
      return;
    }

    try {
      await this.redisClient.setex(
        this.cachePrefix + key,
        ttlSeconds,
        JSON.stringify(value),
      );
    } catch (error: any) {
      console.warn('Cache set error:', error.message);
    }
  }

  /**
   * Compute SHA256 hash for a URL
   */
  private async hashUrl(url: string): Promise<string> {
    const crypto = await import('crypto');
    const canonicalUrl = this.canonicalizeUrl(url);
    const hash = crypto.createHash('sha256').update(canonicalUrl).digest();
    return hash.toString('hex');
  }

  /**
   * Canonicalize URL
   */
  /**
   * Normalize URL according to Safe Browsing specification
   * See: https://developers.google.com/safe-browsing/v4/urls-hashing
   */
  private canonicalizeUrl(url: string): string {
    try {
      // Remove CR, LF, TAB characters
      let normalized = url.replace(/[\r\n\t]/g, '');

      // Parse URL
      const parsed = new URL(normalized);

      // Remove fragment
      parsed.hash = '';

      // Normalize host
      let host = parsed.hostname || '';

      // Remove leading/trailing dots and normalize consecutive dots
      host = host.replace(/^\.+|\.+$/g, '').replace(/\.{2,}/g, '.');

      // Convert to lowercase
      host = host.toLowerCase();

      // Percent-decode host (but be careful with IDNA)
      try {
        host = decodeURIComponent(host);
      } catch {
        // If decode fails, keep original
      }

      // Normalize port (remove default ports)
      let port = parsed.port;
      if (
        (parsed.protocol === 'http:' && port === '80') ||
        (parsed.protocol === 'https:' && port === '443')
      ) {
        port = '';
      }

      // Reconstruct authority
      let authority = host;
      if (parsed.username || parsed.password) {
        authority = '';
        if (parsed.username) authority += parsed.username;
        if (parsed.password) authority += ':' + parsed.password;
        authority += '@' + host;
      }
      if (port) authority += ':' + port;

      // Normalize path
      let path = parsed.pathname;

      // Percent-decode the path
      try {
        path = decodeURIComponent(path);
      } catch {
        // Keep original if decode fails
      }

      // Resolve /./ and /../
      const pathParts: string[] = [];
      for (const part of path.split('/')) {
        if (part === '.' || part === '') {
          if (part === '' && pathParts.length === 0) {
            pathParts.push(''); // Leading slash
          }
          continue;
        }
        if (part === '..') {
          if (pathParts.length > 0 && pathParts[pathParts.length - 1] !== '') {
            pathParts.pop();
          }
        } else {
          pathParts.push(part);
        }
      }
      path = pathParts.join('/');
      if (!path.startsWith('/')) path = '/' + path;

      // Remove consecutive slashes
      path = path.replace(/\/+/g, '/');

      // Reconstruct URL
      let result = `${parsed.protocol}//${authority}${path}`;

      // Add query string (do NOT normalize query)
      if (parsed.search) {
        result += parsed.search;
      }

      console.log('DEBUG canonicalizeUrl:', {
        original: url,
        normalized: result,
      });

      return result;
    } catch (error) {
      console.error('canonicalizeUrl error:', error);
      return url;
    }
  }

  /**
   * Generate all host suffixes for a hostname
   * Example: www.example.com -> [www.example.com, example.com, com]
   */
  private getHostSuffixes(hostname: string): string[] {
    const suffixes: string[] = [];
    const parts = hostname.split('.');

    // Max 5 suffixes per Safe Browsing spec
    for (let i = 0; i < Math.min(5, parts.length); i++) {
      suffixes.push(parts.slice(i).join('.'));
    }

    return suffixes;
  }

  /**
   * Generate all path prefixes for a URL path
   * Example: /a/b/c -> [/a/b/c, /a/b/, /a/]
   */
  private getPathPrefixes(pathname: string): string[] {
    const prefixes: string[] = [];

    if (!pathname.startsWith('/')) {
      pathname = '/' + pathname;
    }

    // Add full path
    prefixes.push(pathname);

    // Add parent directories (max 6 prefixes per Safe Browsing spec)
    const parts = pathname.split('/');
    for (let i = parts.length - 1; i > 1 && prefixes.length < 6; i--) {
      parts.pop();
      prefixes.push(parts.join('/') + '/');
    }

    return prefixes;
  }

  /**
   * Generate all candidate URL patterns from a normalized URL
   * Returns array of host-suffix and path-prefix combinations
   */
  private generateCandidatePatterns(url: string): string[] {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname || '';
      const pathname = parsed.pathname || '/';
      const search = parsed.search || '';

      const hostSuffixes = this.getHostSuffixes(hostname);
      const pathPrefixes = this.getPathPrefixes(pathname);

      const patterns: string[] = [];

      // Generate all combinations (max 30 per Safe Browsing spec)
      for (const hostSuffix of hostSuffixes) {
        for (const pathPrefix of pathPrefixes) {
          if (patterns.length >= 30) break;

          // Note: Don't include search params in prefix matching
          const pattern = `${hostSuffix}${pathPrefix}`;
          patterns.push(pattern);
        }
        if (patterns.length >= 30) break;
      }

      console.log('DEBUG generateCandidatePatterns:', {
        url,
        hostSuffixes,
        pathPrefixes,
        patterns,
        count: patterns.length,
      });

      return patterns;
    } catch (error) {
      console.error('generateCandidatePatterns error:', error);
      return [];
    }
  }

  /**
   * Get hash prefix (first 4 bytes)
   */
  private getHashPrefix(fullHash: string): string {
    const bytes = Buffer.from(fullHash, 'hex').slice(0, 4);
    return bytes.toString('base64');
  }

  /**
   * Parse Protobuf response - NOW WITH DEDICATED DECODER!
   *
   * Much cleaner:
   * - Separated concerns: ProtobufDecoder handles parsing logic
   * - Easier to test: decoder can be unit tested independently
   * - More readable: methods have clear purposes
   * - Maintained: changes to parsing don't affect API logic
   */
  private parseProtobufResponse(buffer: Buffer): {
    fullHashes: any[];
    cacheDuration: string;
  } {
    try {
      const response = ProtobufDecoder.decodeHashSearchResponse(buffer);

      // Convert to match format with fullHashDetails
      const fullHashes = response.fullHashes.map((fh) => ({
        fullHash: fh.fullHash.toString('base64'),
        details: fh.details.map((d) => ({
          threatType: THREAT_TYPE_MAP[d.threatType] || 'MALWARE',
        })),
      }));

      console.log('Parsed response:', {
        fullHashesCount: fullHashes.length,
        cacheDuration: response.cacheDuration,
      });

      return {
        fullHashes,
        cacheDuration: response.cacheDuration,
      };
    } catch (error: any) {
      console.error('Protobuf parse error:', error.message);
      throw error;
    }
  }

  /**
   * Fetch with timeout
   */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit = {},
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Search for hash prefixes
   */
  async searchHashes(hashPrefixes: string[]): Promise<any> {
    if (hashPrefixes.length === 0) {
      return { matches: [] };
    }

    try {
      const params = new URLSearchParams();
      params.append('key', this.apiKey);
      hashPrefixes.forEach((prefix) => {
        params.append('hashPrefixes', prefix);
      });

      console.log('Sending hash search request:', {
        hashPrefixes: hashPrefixes,
        apiKey: this.apiKey.substring(0, 10) + '...',
      });

      const endpoint = `${this.baseUrl}/hashes:search?${params.toString()}`;
      const response = await this.fetchWithTimeout(endpoint, {
        method: 'GET',
        headers: {
          'User-Agent': 'sbserver-v5/1.0',
        },
      });
      console.log(response);

      console.log('Hash search response status:', response.status);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const parsed = this.parseProtobufResponse(buffer);

      const matches: any[] = [];
      for (const fullHash of parsed.fullHashes) {
        for (const detail of fullHash.details) {
          matches.push({
            fullHash: fullHash.fullHash,
            threatType: detail.threatType,
            listName: detail.threatType,
            cacheDuration: parsed.cacheDuration,
            fullHashDetails: fullHash.details, // Include all details
          });
        }
      }

      return { matches, cacheDuration: parsed.cacheDuration };
    } catch (error: any) {
      console.error('Hash search error:', error.message);
      throw error;
    }
  }

  /**
   * Lookup a URL for threats
   */
  async lookupUrl(url: string): Promise<ThreatInfo> {
    try {
      if (!url || typeof url !== 'string') {
        return { error: 'Invalid URL' };
      }

      console.log('Looking up URL:', url);

      // Step 1: Normalize URL
      const canonicalUrl = this.canonicalizeUrl(url);
      console.log('Canonical URL:', canonicalUrl);

      // Step 2: Generate all candidate patterns
      const patterns = this.generateCandidatePatterns(canonicalUrl);
      console.log(`Generated ${patterns.length} candidate patterns`);

      // Step 3: Compute full hashes and prefixes for all patterns
      const crypto = await import('crypto');
      const hashPrefixes: string[] = [];
      const fullHashesMap = new Map<string, string>(); // prefix -> fullHash (hex)

      for (const pattern of patterns) {
        const fullHash = crypto
          .createHash('sha256')
          .update(pattern)
          .digest('hex');
        const hashPrefix = this.getHashPrefix(fullHash);

        hashPrefixes.push(hashPrefix);
        fullHashesMap.set(hashPrefix, fullHash);

        console.log('DEBUG pattern hash:', {
          pattern,
          fullHash: fullHash.substring(0, 16) + '...',
          prefix: hashPrefix,
        });
      }

      console.log(`Sending ${hashPrefixes.length} hash prefixes to API`);

      // Step 4: Query Safe Browsing API with all prefixes
      const response = await this.searchHashes(hashPrefixes);

      if (response.error) {
        console.error('API error:', response.error);
        return { error: response.error };
      }

      // Step 5: Verify full hash matches
      const verifiedMatches: any[] = [];

      if (response.matches && response.matches.length > 0) {
        for (const match of response.matches) {
          // The API returns full hashes (32 bytes, base64-encoded)
          const apiFullHash = match.fullHash;

          // Convert base64 to hex for comparison
          let apiFullHashHex: string;
          try {
            apiFullHashHex = Buffer.from(apiFullHash, 'base64').toString('hex');
          } catch {
            console.warn('Failed to decode base64 fullHash');
            continue;
          }

          // Check if this full hash matches any of our candidate patterns
          let matchesCandidate = false;
          for (const [prefix, ourFullHashHex] of fullHashesMap.entries()) {
            if (apiFullHashHex === ourFullHashHex) {
              matchesCandidate = true;
              console.log('Full hash verified match found:', {
                pattern: patterns[hashPrefixes.indexOf(prefix)],
                threatType: match.threatType,
              });
              break;
            }
          }

          if (matchesCandidate) {
            verifiedMatches.push(match);
          }
        }
      }

      if (verifiedMatches.length > 0) {
        console.log('Threat found after verification:', verifiedMatches.length);
        return this.convertToThreatInfo({ matches: verifiedMatches });
      }

      console.log('No verified threats found for URL');
      return { threatMatches: [] };
    } catch (error: any) {
      console.error('URL lookup error:', error.message);
      return { error: error.message || 'Lookup failed' };
    }
  }

  /**
   * Convert response to ThreatInfo
   */
  private convertToThreatInfo(response: any): ThreatInfo {
    if (!response.matches || response.matches.length === 0) {
      return { threatMatches: [] };
    }

    const threatMatches: ThreatMatch[] = response.matches.map((match: any) => ({
      threatType: match.threatType,
      listName: match.listName,
      cacheDuration: match.cacheDuration,
      fullHash: match.fullHash,
      fullHashDetails: match.fullHashDetails,
    }));

    return { threatMatches };
  }

  /**
   * Parse cache duration
   */
  private parseCacheDurationToSeconds(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) {
      return 3600;
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 60 * 60;
      case 'd':
        return value * 24 * 60 * 60;
      default:
        return 3600;
    }
  }

  /**
   * Disconnect Redis
   */
  async disconnect(): Promise<void> {
    if (this.redisClient) {
      try {
        await this.redisClient.quit();
        console.log('Redis client disconnected');
      } catch (error: any) {
        console.error('Error disconnecting Redis:', error.message);
      }
    }
  }

  /**
   * Search URLs directly using v5 API
   * https://safebrowsing.googleapis.com/v5/urls:search
   * Uses GET method with urls[] query parameters
   */
  async searchUrls(urls: string[]): Promise<any> {
    if (!urls || urls.length === 0) {
      return { error: 'URLs array is required' };
    }

    if (urls.length > 50) {
      return { error: 'Maximum 50 URLs are allowed per request' };
    }

    try {
      const cacheKey = `urls:${urls.join('|')}`;
      const cached = await this.getCached(cacheKey);
      if (cached) {
        console.log('Cache hit for URLs:', urls);
        return cached;
      }

      console.log('Searching URLs:', urls);

      // Build query string with urls[] parameters
      const params = new URLSearchParams();
      for (const url of urls) {
        params.append('urls', url);
      }

      const apiUrl = `${this.baseUrl}/urls:search?key=${this.apiKey}&${params.toString()}`;
      console.log('API URL:', apiUrl);

      const response = await this.fetchWithTimeout(apiUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'SafeBrowsingV5Client/1.0',
        },
      });

      console.log('API Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error:', response.status, errorText);
        return { error: `API error: ${response.status} ${errorText}` };
      }

      // Response is protobuf format, convert to buffer
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      console.log('Received protobuf buffer, length:', buffer.length);

      // Parse protobuf response
      const decoded = ProtobufDecoder.decodeUrlSearchResponse(buffer);
      console.log('Decoded threats:', decoded.threats);
      console.log('Cache duration:', decoded.cacheDuration);

      // Convert threat types to readable format
      const result: any = {};
      if (decoded.threats && decoded.threats.length > 0) {
        result.threats = decoded.threats.map((threat) => ({
          url: threat.url,
          threatTypes: threat.threatTypes.map(
            (type) => THREAT_TYPE_MAP[type] || `UNKNOWN_${type}`,
          ),
        }));
      }
      result.cacheDuration = decoded.cacheDuration;

      console.log('API Result:', JSON.stringify(result, null, 2));

      // Cache the result with appropriate duration
      await this.setCached(cacheKey, result as any[], 3600); // 1 hour cache

      return result;
    } catch (error: any) {
      console.error('Error searching URLs:', error.message);
      return { error: error.message };
    }
  }
}

export { SafeBrowsingClient, ThreatInfo };
