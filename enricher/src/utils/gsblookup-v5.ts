import { SafeBrowsingClient, ThreatInfo } from './safeBrowsingClient.js';

interface GSBResponse {
  threatMatches?: any[];
  error?: string;
}

let safeBrowsingClient: SafeBrowsingClient | null = null;

/**
 * Initialize SafeBrowsingClient v5
 */
export async function initializeSafeBrowsingClientV5(): Promise<void> {
  const apiKey = process.env.GSBKEY;

  if (!apiKey) {
    console.warn(
      'GOOGLE_SAFE_BROWSING_API_KEY not set, GSB v5 lookup will be disabled',
    );
    return;
  }

  try {
    safeBrowsingClient = new SafeBrowsingClient(apiKey);
    await safeBrowsingClient.initialize();
    console.log('SafeBrowsingClient v5 initialized successfully');
  } catch (error: any) {
    console.error('Failed to initialize SafeBrowsingClient v5:', error.message);
    safeBrowsingClient = null;
  }
}

/**
 * Get SafeBrowsingClient v5 instance
 */
export function getSafeBrowsingClientV5(): SafeBrowsingClient | null {
  return safeBrowsingClient;
}

/**
 * Disconnect SafeBrowsingClient v5
 */
export async function disconnectSafeBrowsingClientV5(): Promise<void> {
  if (safeBrowsingClient) {
    await safeBrowsingClient.disconnect();
    safeBrowsingClient = null;
  }
}

/**
 * Lookup URL using SafeBrowsingClient v5
 */
export async function lookupUrlV5(url: string): Promise<GSBResponse> {
  if (!safeBrowsingClient) {
    console.warn('SafeBrowsingClient v5 not initialized, returning error');
    return { error: 'SafeBrowsingClient v5 not initialized' };
  }

  try {
    console.log('GSB v5 lookup using SafeBrowsingClient for URL:', url);
    const threatInfo: ThreatInfo = await safeBrowsingClient.lookupUrl(url);

    if (threatInfo.error) {
      console.error('GSB v5 lookup error:', threatInfo.error);
      return { error: threatInfo.error };
    }

    // Convert threatMatches to matches format for backward compatibility
    if (threatInfo.threatMatches && threatInfo.threatMatches.length > 0) {
      return {
        threatMatches: threatInfo.threatMatches,
      };
    }

    return { threatMatches: [] };
  } catch (error: any) {
    console.error('GSB v5 lookup failed:', error.message);
    return { error: error.message || 'GSB v5 lookup failed' };
  }
}

/**
 * Search URLs using SafeBrowsingClient v5 urls:search API
 */
export async function searchUrlsV5(urls: string[]): Promise<GSBResponse> {
  if (!safeBrowsingClient) {
    console.warn('SafeBrowsingClient v5 not initialized, returning error');
    return { error: 'SafeBrowsingClient v5 not initialized' };
  }

  try {
    console.log('GSB v5 searchUrls:', urls);
    const result = await safeBrowsingClient.searchUrls(urls);

    if (result.error) {
      console.error('GSB v5 searchUrls error:', result.error);
      return { error: result.error };
    }

    return result;
  } catch (error: any) {
    console.error('GSB v5 searchUrls failed:', error.message);
    return { error: error.message || 'GSB v5 searchUrls failed' };
  }
}
