import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  define: {
    'process.env': '{}',
    global: 'window',
    Buffer: 'Uint8Array',
  },
  base: '/pengovr/',
  server: {
    port: 3001,
    host: '0.0.0.0',
    allowedHosts: ['pengovr.local', 'api.pengovr.local', 'localhost'],
    proxy: {
      '/admin/queues': {
        target: process.env.VITE_API_URL || 'http://localhost:3000',
        changeOrigin: true,
      },
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
    fs: {
      strict: false,
    },
  },
  assetsInclude: ['**/*.wasm'],
  build: {
    target: 'esnext',
    rollupOptions: {
      input: './index.html',
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.wasm')) {
            return 'assets/[name].[hash][extname]';
          }
          return 'assets/[name].[hash][extname]';
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['@virustotal/yara-x'],
  },
});
