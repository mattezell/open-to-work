/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1600,
  },
  server: {
    port: 5180,
    host: '127.0.0.1',
    allowedHosts: [], // extra hosts: __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
