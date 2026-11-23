/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  appType: 'spa',
  resolve: {
    dedupe: ['lit', 'lit-html', 'lit-element', '@lit/reactive-element'],
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 1200,
  },
  server: {
    port: 5173,
    host: '127.0.0.1',
  },
  preview: {
    port: 4173,
    host: '127.0.0.1',
  },
  test: {
    environment: 'happy-dom',
    include: ['tests/unit/**/*.test.ts'],
  },
});
