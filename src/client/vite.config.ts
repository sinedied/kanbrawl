import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/mcp': 'http://localhost:3000',
      '/events': {
        target: 'http://localhost:3000',
        headers: { Connection: '' },
      },
    },
  },
});
