module.exports = {
  apps: [
    {
      name: 'pengovr-api',
      script: 'src/index.ts',
      interpreter: 'tsx',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000,
        MONGODB_URI: 'mongodb://localhost:27017/webscraping',
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
      },
      env_docker: {
        NODE_ENV: 'docker',
        PORT: 3000,
        MONGODB_URI: 'mongodb://mongo:27017/webscraping',
        REDIS_HOST: 'redis',
        REDIS_PORT: '6379',
      },
      env_kubernetes: {
        NODE_ENV: 'kubernetes',
        PORT: 3000,
        MONGODB_URI: 'mongodb://mongodb-service:27017/webscraping',
        REDIS_HOST: 'redis-service',
        REDIS_PORT: '6379',
      },
      ignore_watch: ['node_modules', 'logs', 'dist'],
      max_memory_restart: '1G',
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
    },
  ],
};
