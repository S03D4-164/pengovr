import express, { Express, Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import { SafeBrowsingClient, ThreatInfo } from './safeBrowsingClient.js';

// Load environment variables
dotenv.config();

const app: Express = express();
const port = parseInt(process.env.PORT || '3002', 10);
const apiKey = process.env.GSBKEY;

// Initialize Safe Browsing client
let sbClient: SafeBrowsingClient;

async function initializeApp() {
  try {
    if (!apiKey) {
      throw new Error('GSBKEY environment variable is not set');
    }
    sbClient = new SafeBrowsingClient(apiKey);
    await sbClient.initialize();
    console.log('Safe Browsing v5 client initialized');
  } catch (error: any) {
    console.error('Failed to initialize Safe Browsing client:', error.message);
    process.exit(1);
  }
}

// Middleware
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', version: '5.0.0' });
});

/**
 * v5 API Endpoint - Direct hash search
 */
app.post('/v5/hashes:search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { hashPrefixes } = req.body;

    if (!Array.isArray(hashPrefixes) || hashPrefixes.length === 0) {
      return res.status(400).json({
        error: 'Invalid request: hashPrefixes array is required',
      });
    }

    console.log('Searching hashes:', hashPrefixes);
    const result = await sbClient.searchHashes(hashPrefixes);

    res.json(result);
  } catch (error: any) {
    console.error('Error in hashes:search:', error.message);
    next(error);
  }
});

/**
 * v5 API Endpoint - Threat check for URLs
 */
app.post('/v5/threatMatches:find', async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('Request body:', JSON.stringify(req.body, null, 2));

    const threatInfo = req.body?.threatInfo;
    if (!threatInfo || !threatInfo.threatEntries || threatInfo.threatEntries.length === 0) {
      return res.status(400).json({
        error: 'Invalid request: threatInfo.threatEntries is required',
      });
    }

    const threatEntries = threatInfo.threatEntries;
    const results: any[] = [];

    // Process each threat entry
    for (const entry of threatEntries) {
      if (entry.url) {
        console.log('Looking up URL:', entry.url);
        const lookupResult = await sbClient.lookupUrl(entry.url);

        if (lookupResult.error) {
          console.error('Error looking up URL:', lookupResult.error);
          continue;
        }

        if (lookupResult.threatMatches && lookupResult.threatMatches.length > 0) {
          const matches = lookupResult.threatMatches.map((threat) => ({
            threatType: threat.threatType,
            threat: {
              url: entry.url,
            },
            cacheDuration: threat.cacheDuration,
            listName: threat.listName,
          }));

          results.push(...matches);
        }
      }
    }

    const response: any = {};
    if (results.length > 0) {
      response.matches = results;
    }

    console.log('Response:', JSON.stringify(response, null, 2));
    res.json(response);
  } catch (error: any) {
    console.error('Error in threatMatches:find:', error.message);
    next(error);
  }
});

// Error handling middleware
app.use((error: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : undefined,
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
async function startServer() {
  await initializeApp();

  app.listen(port, '0.0.0.0', () => {
    console.log(`Safe Browsing v5 server running on port ${port}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await sbClient.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await sbClient.disconnect();
  process.exit(0);
});

// Start the app
startServer().catch((error) => {
  console.error('Failed to start server:', error.message);
  process.exit(1);
});
