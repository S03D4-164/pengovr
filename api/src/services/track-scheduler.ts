import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import crypto from 'crypto';
import mongoose from 'mongoose';
import Website from '../models/website';
import WebpageModel from '../models/webpage';
import { logError, shouldLog } from '../utils/logger';

/**
 * Initializes a BullMQ Repeatable Job to check for websites that need automated tracking.
 */
export const initTrackScheduler = async (
  redisConnection: Redis,
  scrapingQueue: Queue,
  schedulerQueue: Queue,
) => {
  const initTimestamp = new Date().toISOString();
  console.log(`[${initTimestamp}] Initializing Track Scheduler...`);
  await schedulerQueue.obliterate({ force: true });

  // Remove existing repeatable jobs for this queue to avoid duplicates if the pattern changed.
  const repeatableJobs = await schedulerQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    if (job.name === 'check-tracking-tasks') {
      await schedulerQueue.removeRepeatableByKey(job.key);
    }
  }

  // Add the repeatable job (runs every minute)
  // Using a unique job id to prevent duplicate schedulers
  await schedulerQueue.add(
    'check-tracking-tasks',
    {},
    {
      repeat: { pattern: '*/5 * * * *' }, // Cron format: every 5 minutes
      jobId: 'check-tracking-job',
      removeOnComplete: true,
    },
  );

  // Worker to process the scheduler job
  const worker = new Worker(
    'tracking-scheduler',
    async (job: Job) => {
      const now = new Date();
      const timestamp = now.toISOString();
      console.log(`[${timestamp}] [Track Scheduler] Running periodic check...`);

      const websites = await Website.find({
        'track.counter': { $gte: 1 },
      }).populate('last');

      for (const site of websites) {
        const lastScrapeTime = site.last
          ? new Date((site.last as any).createdAt).getTime()
          : 0;
        // periodを時間(hours)として扱い、ミリ秒に変換 (hours * 3600 * 1000)
        const periodInMs = (site.track.period || 1) * 3600 * 1000;

        if (now.getTime() - lastScrapeTime >= periodInMs) {
          const webpageId = new mongoose.Types.ObjectId();
          const jobId = crypto.randomBytes(16).toString('hex');
          console.log(
            `[${timestamp}] [Track Scheduler] Conditions met for: ${site.url}. Pre-creating Webpage ${webpageId} and queuing job ${jobId}.`,
          );

          // Pre-create Webpage document
          const webpage = new WebpageModel({
            _id: webpageId,
            input: site.url,
            option: site.track.option,
          });
          await webpage.save();

          // Update Website to point to the new pending Webpage immediately
          site.last = webpageId as any;
          await site.save();

          // 4. Add the job to BullMQ
          await scrapingQueue.add(
            'scrape',
            {
              id: jobId,
              url: site.url,
              options: {
                ...site.track.option,
              },
              webpageId: webpageId.toString(),
            },
            { jobId },
          );
        }
      }
    },
    { connection: redisConnection },
  );

  worker.on('error', (err) => {
    if (shouldLog()) {
      logError('Track Scheduler Worker Error', err);
    }
  });
};
