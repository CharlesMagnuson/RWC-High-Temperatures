/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    passWithNoTests: true,
    // @testing-library/react only auto-registers its afterEach(cleanup) hook
    // when it detects a global `afterEach`; without this, DOM from one test
    // leaks into the next within the same file.
    globals: true,
  },
});
