import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import crypto from 'crypto';
import mongoose from 'mongoose';
import Website from '../models/website';
import WebpageModel from '../models/webpage';
import Task from '../models/tasks';
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

  // Remove existing repeatable jobs for this queue to avoid duplicates if the pattern changed.
  const repeatableJobs = await schedulerQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    if (job.name === 'check-tracking-tasks') {
      await schedulerQueue.removeRepeatableByKey(job.key);
    }
  }

  // 2. Add the repeatable job (runs every minute)
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

  // 3. Worker to process the scheduler job
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
        // Skip if there's already an active (pending/processing) task for this site
        const lastStatus = (site.last as any)?.status;
        if (lastStatus === 'pending' || lastStatus === 'processing' || lastStatus === 0) {
          continue;
        }

        const lastScrapeTime = site.last ? new Date((site.last as any).createdAt).getTime() : 0;
        // periodを時間(hours)として扱い、ミリ秒に変換 (hours * 3600 * 1000)
        const periodInMs = (site.track.period || 1) * 3600 * 1000;

        if (now.getTime() - lastScrapeTime >= periodInMs) {
          const webpageId = new mongoose.Types.ObjectId();
          const jobId = crypto.randomBytes(16).toString('hex');
          console.log(
            `[${timestamp}] [Track Scheduler] Conditions met for: ${site.url}. Pre-creating Webpage ${webpageId} and queuing job ${jobId}.`,
          );

          // 1. Pre-create Webpage document
          const webpage = new WebpageModel({
            _id: webpageId,
            input: site.url,
            status: 0, // 数値の 0 (pending) に統一
          });
          await webpage.save();

          // 2. Create Task document linked to the Webpage
          const task = new Task({
            id: jobId,
            url: site.url,
            status: 'pending',
            webpageId: webpageId,
          });
          await task.save();

          // 3. Update Website to point to the new pending Webpage immediately
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
                counter: site.track.counter,
                period: site.track.period,
                websiteId: site._id.toString(),
              },
              webpageId: webpageId.toString(),
              webpage: webpage.toObject(),
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
