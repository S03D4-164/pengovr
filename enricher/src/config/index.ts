const config = {
  mongoUri:
    process.env.MONGODB_URI || 'mongodb://localhost:27017/webscraping?directConnection=true',
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || 'pengovr-password',
  },
  queueName: process.env.QUEUE_NAME || 'scraping-tasks',
  enrichmentQueue: process.env.ENRICHMENT_QUEUE || 'enrichment-tasks',
  completionChannel: process.env.COMPLETION_CHANNEL || 'task-completion',
  pollInterval: parseInt(process.env.POLL_INTERVAL || '5000', 10),
  scheduleInterval: parseInt(process.env.SCHEDULE_INTERVAL || '3600000', 10), // 1 hour in milliseconds
  usePlaywget: process.env.USE_PLAYWGET !== 'false',
  s3: {
    endpoint: process.env.S3_ENDPOINT,
    accessKey: process.env.S3_ACCESS_KEY || 'pengovr-admin',
    secretKey: process.env.S3_SECRET_KEY || 'pengovr-password',
    bucket: process.env.S3_BUCKET || 'pengovr-assets',
    region: process.env.S3_REGION || 'us-east-1',
  },
};

export default config;
