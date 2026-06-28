const path = require('path');

module.exports = {
  apps: [
    {
      name: 'wgeteer',
      script: 'src/index.ts',
      interpreter: 'node',
      node_args: '--import tsx/esm', 
      instances: 1,
      autorestart: true,
      env_production: {
        NODE_ENV: 'production',
        DEBUG: 'custom:*',
      },
      env_development: {
        NODE_ENV: 'development',
        DEBUG: 'custom:*',
      },
      watch:
        process.env.NODE_ENV !== 'production' ? path.resolve(__dirname) : false,
      ignore_watch: ['node_modules', 'public'],
      max_memory_restart: '4G',
    },
  ],
};
