import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8431',
      '/mcp': 'http://localhost:8431',
      '/events': {
        target: 'http://localhost:8431',
        headers: { Connection: '' },
      },
    },
  },
});
