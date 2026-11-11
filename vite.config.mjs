import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import process from 'node:process';

// Study version (README, "Versión de estudio"): a separate Render service built with STUDY_MODE=true.
// The flag is fixed at build time, so the main version's files do not even contain the study code.
// STUDY_KEY goes into the study version's files: it keeps out stray requests, it is not a secret.
// __STUDY__ is written into each file as a plain true/false (an imported constant would not let the
// build drop the study files). Vitest makes it a global instead, so a test file can switch it on.
const studyBuild = process.env.STUDY_MODE === 'true';
process.env.VITE_STUDY_KEY = studyBuild ? process.env.STUDY_KEY || '' : '';
const studyFlag = JSON.stringify(studyBuild);

export default defineConfig({
  plugins: [react()],
  define: { __STUDY__: studyFlag },
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
