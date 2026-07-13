import { Worker, Job } from 'bullmq';
import config from './config/index.js';
import Scraper from './scraper.js';
import { ensureBucketExists } from './utils/s3.js';

const queueName = config.queueName;
const scraper = new Scraper();
let worker: Worker | null = null;

async function main() {
  console.log('Checking S3 bucket status...');
  try {
    await ensureBucketExists();
    console.log('S3 Bucket initialization completed successfully.');
  } catch (error: any) {
    console.error('Failed to initialize S3 Bucket:', error.message);
    process.exit(1);
  }

  /**
   * BullMQ Worker instance
   */
  worker = new Worker(
    queueName,
    async (job: Job) => {
      const { url, options, webpageId } = job.data;
      console.log(`[Job ${job.id}] Processing URL: ${url}`);

      try {
        // Execute scraping
        // The results (webpage, website, storage keys) will be returned
        const result = await scraper.scrape(url, {
          ...options,
          existingWebpageId: webpageId,
        });

        console.log(`[Job ${job.id}] Completed successfully`);

        // Returning the result here sends it to the BullMQ completion event
        // The result-listener.ts in the API side will receive this.
        console.log(result);
        return {
          success: true,
          ...result,
        };
      } catch (error: any) {
        console.error(`[Job ${job.id}] Failed:`, error.message);
        // Throwing an error will move the job to the 'failed' state in BullMQ
        throw error;
      }
    },
    {
      connection: {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
      },
      concurrency: Number(config.concurrency),
    },
  );

  worker.on('ready', () => {
    console.log(`Worker is ready and listening on queue: ${queueName}`);
  });

  worker.on('error', (err) => {
    console.error('Worker error:', err);
  });
}

main().catch((err) => {
  console.error('Failed to start application:', err);
  process.exit(1);
});

/**
 * Graceful Shutdown
 */
async function shutdown() {
  console.log('Shutting down worker...');
  if (worker) {
    await worker.close();
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
