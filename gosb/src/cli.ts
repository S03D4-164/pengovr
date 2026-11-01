import { SafeBrowsingClient } from './safeBrowsingClient.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const apiKey = process.env.GSBKEY;

if (!apiKey) {
  console.error('Error: GSBKEY environment variable is not set');
  process.exit(1);
}

// Get URL from command line arguments
const url = process.argv[2];

if (!url) {
  console.error('Usage: npm run check-url <url>');
  process.exit(1);
}

async function main() {
  const client = new SafeBrowsingClient(apiKey as string);
  
  try {
    console.log('Safe Browsing v5 URL Checker');
    console.log('=============================\n');
    console.log(`Checking URL: ${url}\n`);
    
    // Initialize Redis connection for caching
    await client.initialize();
    
    console.log('Sending request to Google Safe Browsing API...\n');
    const result = await client.lookupUrl(url);

    if (result.error) {
      console.error('Error:', result.error);
      process.exit(1);
    }

    if (!result.threatMatches || result.threatMatches.length === 0) {
      console.log('✓ URL is SAFE');
      console.log('No threats detected.');
    } else {
      console.log('⚠ URL is UNSAFE');
      console.log(`Found ${result.threatMatches.length} threat(s):\n`);
      
      result.threatMatches.forEach((match, index) => {
        console.log(`Threat ${index + 1}:`);
        console.log(`  Type: ${match.threatType}`);
        console.log(`  List: ${match.listName}`);
        console.log(`  Cache Duration: ${match.cacheDuration}`);
        
        // Display fullHash
        if (match.fullHash) {
          console.log(`  Full Hash: ${match.fullHash}`);
        }
        
        // Display fullHashDetails
        if (match.fullHashDetails && match.fullHashDetails.length > 0) {
          console.log(`  Hash Details:`);
          match.fullHashDetails.forEach((detail, detailIndex) => {
            console.log(`    [${detailIndex + 1}] Threat Type: ${detail.threatType}`);
          });
        }
        
        console.log();
      });
    }
    
    // Show API mode info
    console.log('---');
    console.log('This CLI uses the internal lookupUrl() method.');
    console.log('For REST API access, use the Express server:');
    console.log('  npm start');
    console.log('Then POST to http://localhost:3002/v5/threatMatches:find');

  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    // Always disconnect Redis client before exiting
    await client.disconnect();
    process.exit(0);
  }
}

main();
