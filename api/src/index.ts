import express from 'express';
//import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import Redis from 'ioredis';
import { Queue } from 'bullmq';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

import config from './config';
import taskRoutes from './routes/tasks';
import websiteRoutes from './routes/websites';
import webpageRoutes from './routes/webpages';
import responseRoutes from './routes/responses';
import requestRoutes from './routes/requests';
import payloadRoutes from './routes/payloads';
import removeRoutes from './routes/remove';
import screenshotRoutes from './routes/screenshots';
import yaraRoutes from './routes/yaras';
import geminiRoutes from './routes/gemini';
import userAgentsRoutes from './routes/userAgents';
import ResultListener from './services/result-listener';
import { initResultListeners } from './services/resultProcessor';
import { initTrackScheduler } from './services/track-scheduler';
import { logError, shouldLog } from './utils/logger';

const app: express.Application = express();

// Middleware
//app.use(cors());
app.use(express.json({ limit: '10mb' }));
// helmetのデフォルト設定から upgrade-insecure-requests を除外する
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'upgrade-insecure-requests': null, // これをnullに設定
      },
    },
  }),
);

// MongoDB Connection - MUST wait for connection before starting server
const mongooseOptions = {
  serverSelectionTimeoutMS: 5000, // DB接続不可時に素早くエラーを返してUIを更新するため短縮 (旧: 30s)
  socketTimeoutMS: 30000,         // 検索などの重いクエリの実行時間を考慮し、ソケットタイムアウトは30秒を維持
  bufferCommands: true,           // 初期接続完了前にクエリが呼ばれた際のクラッシュを防ぐため有効化 (タイムアウトは bufferTimeoutMS で制御)
  maxPoolSize: 10,
  minPoolSize: 2,
  maxIdleTimeMS: 30000,
  waitQueueTimeoutMS: 5000,       // コネクションの空き待ちタイムアウトも5秒に短縮 (旧: 30s)
  readPreference: 'primaryPreferred' as const,
};

// Set mongoose buffering timeout globally
mongoose.set('bufferTimeoutMS', 5000); // クエリバッファが発生した場合のタイムアウト設定 (旧: 30s)

// Connect to MongoDB and wait for ready before starting server
async function startServer() {
  console.log('Starting server...');
  console.log('MongoDB URI:', config.mongoUri);
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(config.mongoUri, mongooseOptions);
    console.log('MongoDB connection established');

    // Wait for 'open' event to ensure connection is fully ready
    if (mongoose.connection.readyState !== 1) {
      console.log('Waiting for MongoDB connection to be fully ready...');
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('MongoDB connection timeout after 30s'));
        }, 30000);

        mongoose.connection.once('open', () => {
          clearTimeout(timeout);
          resolve(undefined);
        });

        mongoose.connection.once('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
    }

    console.log('MongoDB is ready for operations, readyState:', mongoose.connection.readyState);

    // Start server
    app.listen(PORT, () => {
      console.log(`API server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('MongoDB connection failed:', err);
    process.exit(1);
  }
}

// Redis Connection (configured for BullMQ compatibility)
const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    const delay = Math.min(times * 100, 10000);
    return delay;
  },
});

redis.on('connect', () => {
  console.log('Connected to Redis');
});

redis.on('error', (err: Error) => {
  if (shouldLog()) {
    logError('Redis connection error (throttled)', err);
  }
});

// Initialize BullMQ Queue
const scrapingQueue = new Queue(config.queueName, {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 100, // 完了したジョブを100件まで保持して確認可能にする
    removeOnFail: 100, // 失敗したジョブを100件まで保持してデバッグ可能にする
  },
}).on('error', (err) => {
  if (shouldLog()) logError('BullMQ Queue Error (Scraping)', err);
});

// Initialize Enrichment Queue (for GSB, Gemini, VT, etc.)
const enrichmentQueue = new Queue(config.enrichmentQueue, {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 100, // 完了したジョブを100件まで保持
    removeOnFail: 100, // 失敗したジョブを100件まで保持
  },
}).on('error', (err) => {
  if (shouldLog()) logError('BullMQ Queue Error (Enrichment)', err);
});

// Initialize Scheduler Queue
const schedulerQueue = new Queue('tracking-scheduler', {
  connection: redis,
}).on('error', (err) => {
  if (shouldLog()) logError('BullMQ Queue Error (Scheduler)', err);
});

// Make redis and queue available to routes
app.locals.redis = redis;
app.locals.scrapingQueue = scrapingQueue;
app.locals.enrichmentQueue = enrichmentQueue;
app.locals.schedulerQueue = schedulerQueue;

// Initialize Bull Board
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [
    new BullMQAdapter(scrapingQueue),
    new BullMQAdapter(enrichmentQueue),
    new BullMQAdapter(schedulerQueue),
  ],
  serverAdapter: serverAdapter,
});

// Redis接続がある場合のみ、リスナーやスケジューラを開始
redis.once('ready', () => {
  console.log('Redis is ready, starting listeners...');
  // Start BullMQ result listener
  const resultListener = new ResultListener(redis, enrichmentQueue);
  resultListener.listen();

  // Start Enrichment result listener (GSB, Gemini, YARA results)
  initResultListeners(redis, enrichmentQueue);

  // Start scheduled track checking
  initTrackScheduler(redis, scrapingQueue, schedulerQueue);
});

// Health check endpoint
app.get('/health', (req: any, res: any) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use('/api/tasks', taskRoutes);
app.use('/api/websites', websiteRoutes);
app.use('/api/webpages', webpageRoutes);
app.use('/api/responses', responseRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/payloads', payloadRoutes);
app.use('/api/remove', removeRoutes);
app.use('/api/screenshots', screenshotRoutes);
app.use('/api/yaras', yaraRoutes);
app.use('/api/gemini', geminiRoutes);
app.use('/api/user-agents', userAgentsRoutes);
app.use('/admin/queues', serverAdapter.getRouter());

// Error handling
app.use((err: Error, req: any, res: any, next: any) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// 404 handler - must be after all routes
app.use((req: any, res: any) => {
  res.status(404).json({ error: 'Resource not found' });
});

const PORT = config.port;

// Start the server
startServer();

export default app;
