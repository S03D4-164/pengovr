const config = {
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || 'pengovr-password',
  },
  queueName: process.env.QUEUE_NAME || 'scraping-tasks',
  pollInterval: parseInt(process.env.POLL_INTERVAL || '5000', 10),
  usePlaywget: process.env.USE_PLAYWGET !== 'false',
  s3: {
    endpoint: process.env.S3_ENDPOINT || 'http://127.0.0.1:8333',
    accessKey: process.env.S3_ACCESS_KEY || 'pengovr-admin',
    secretKey: process.env.S3_SECRET_KEY || 'pengovr-password',
    bucket: process.env.S3_BUCKET || 'pengovr-assets',
  },
};

export default config;
