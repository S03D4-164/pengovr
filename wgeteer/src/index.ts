import { Worker, Job } from 'bullmq';
import config from './config/index.js';
import Scraper from './scraper.js';

// キュー名の一致を確認 (デフォルトをプロジェクトで使われている 'ppengo' に設定)
const queueName = process.env.QUEUE_NAME || config.queueName;

const scraper = new Scraper();

/**
 * BullMQ Worker instance
 */
const worker = new Worker(
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
    //concurrency: config.concurrency || 1,
  },
);

worker.on('ready', () => {
  console.log(`Worker is ready and listening on queue: ${queueName}`);
});

worker.on('error', (err) => {
  console.error('Worker error:', err);
});

/**
 * Graceful Shutdown
 */
async function shutdown() {
  console.log('Shutting down worker...');
  await worker.close();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
