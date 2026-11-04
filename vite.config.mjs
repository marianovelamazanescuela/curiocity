import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    // Same role as CRA's "proxy" field: forward API calls to the Express server (npm run start:proxy).
    proxy: {
      '/api': 'http://localhost:4000'
    }
  },
  build: {
    // Keep CRA's output folder so server/index.js, netlify.toml and render.yaml keep working.
    outDir: 'build',
    // TensorFlow.js (~1.1 MB) is a lazily loaded fallback chunk, not part of the initial page.
    chunkSizeWarningLimit: 800
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.js',
    passWithNoTests: true
  }
});
