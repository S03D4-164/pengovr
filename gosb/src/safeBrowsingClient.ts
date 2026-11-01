/**
 * Safe Browsing v5 API Client
 * Improved Protobuf parsing with dedicated decoder class
 */
import { ProtobufDecoder } from './protobufDecoder.js';
import { createClient, RedisClientType } from 'redis';

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
  private redisClient: RedisClientType | null = null;
  private timeout: number = 10000;
  private cachePrefix: string = 'gosb:hash:';

  constructor(apiKey: string, redisClient?: RedisClientType) {
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
      this.redisClient = createClient({
        socket: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
          reconnectStrategy: (retries) => Math.min(retries * 50, 500),
        },
        password: process.env.REDIS_PASSWORD || undefined,
      });

      this.redisClient.on('error', (err) => console.log('Redis Client Error', err));
      await this.redisClient.connect();
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
  private async setCached(key: string, value: any[], ttlSeconds: number): Promise<void> {
    if (!this.redisClient) {
      return;
    }

    try {
      await this.redisClient.setEx(
        this.cachePrefix + key,
        ttlSeconds,
        JSON.stringify(value)
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
  private canonicalizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      parsed.hash = '';
      if (
        (parsed.protocol === 'http:' && parsed.port === '80') ||
        (parsed.protocol === 'https:' && parsed.port === '443')
      ) {
        parsed.port = '';
      }
      return parsed.toString();
    } catch {
      return url;
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
  private parseProtobufResponse(buffer: Buffer): { fullHashes: any[]; cacheDuration: string } {
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
  private async fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
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

      const fullHash = await this.hashUrl(url);
      const hashPrefix = this.getHashPrefix(fullHash);

      console.log('URL hashed:', { fullHash: fullHash.substring(0, 16) + '...', hashPrefix });

      const cacheKey = hashPrefix;
      const cached = await this.getCached(cacheKey);
      if (cached !== null) {
        console.log('Cache hit for:', hashPrefix);
        if (cached.length > 0) {
          console.log('Threat found in cache:', cached.length);
          return this.convertToThreatInfo({ matches: cached });
        }
        return { threatMatches: [] };
      }

      console.log('Cache miss, querying Google API');

      const response = await this.searchHashes([hashPrefix]);

      if (response.matches) {
        const cacheDurationSeconds = this.parseCacheDurationToSeconds(response.cacheDuration || '3600s');
        await this.setCached(cacheKey, response.matches, cacheDurationSeconds);
        console.log('Cached results in Redis for:', hashPrefix);

        if (response.matches.length > 0) {
          console.log('Threat found:', response.matches.length);
          return this.convertToThreatInfo(response);
        }
      }

      console.log('No threats found for URL');
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
        await this.redisClient.disconnect();
        console.log('Redis client disconnected');
      } catch (error: any) {
        console.error('Error disconnecting Redis:', error.message);
      }
    }
  }
}

export { SafeBrowsingClient, ThreatInfo };
