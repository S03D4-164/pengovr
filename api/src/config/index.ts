function getMongoUri(): string {
  if (process.env.MONGODB_URI) {
    return process.env.MONGODB_URI;
  }

  // 環境ごとのデフォルト設定
  switch (process.env.NODE_ENV) {
    case 'development':
      return 'mongodb://localhost:27017/webscraping?directConnection=true';
    case 'docker':
      return 'mongodb://mongo:27017/webscraping';
    case 'kubernetes':
      return 'mongodb://mongodb-service:27017/webscraping';
    default:
      return 'mongodb://127.0.0.1:27017/webscraping?directConnection=true';
  }
}

function getRedisHost(): string {
  if (process.env.REDIS_HOST) {
    return process.env.REDIS_HOST;
  }

  // 環境ごとのデフォルト設定
  switch (process.env.NODE_ENV) {
    case 'development':
      return '127.0.0.1';
    case 'docker':
      return 'redis';
    case 'kubernetes':
      return 'redis-service';
    default:
      return '127.0.0.1';
  }
}

const config = {
  port: parseInt(process.env.PORT || '3000'),
  mongoUri: getMongoUri(),
  redis: {
    host: getRedisHost(),
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || 'pengovr-password',
  },
  queueName: process.env.QUEUE_NAME || 'scraping-tasks',
  enrichmentQueue: process.env.ENRICHMENT_QUEUE || 'enrichment-tasks',
  isProduction: process.env.NODE_ENV === 'production',
  s3: {
    endpoint: process.env.S3_ENDPOINT || 'http://127.0.0.1:8333',
    accessKey: process.env.S3_ACCESS_KEY || 'pengovr-admin',
    secretKey: process.env.S3_SECRET_KEY || 'pengovr-password',
    bucket: process.env.S3_BUCKET || 'pengovr-assets',
  },
};

export default config;
