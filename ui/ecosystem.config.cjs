module.exports = {
  apps: [
    {
      name: 'pengovr-ui',
      script: 'pnpm',
      args: 'run dev',
      cwd: '/app/ui',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        VITE_API_URL: 'http://localhost:3000',
      },
      error_file: '/app/ui/logs/pm2-error.log',
      out_file: '/app/ui/logs/pm2-out.log',
      log_file: '/app/ui/logs/pm2-combined.log',
      time: true,
    },
  ],
};
