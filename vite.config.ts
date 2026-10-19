import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { devApiPlugin } from './server/devApiPlugin';

export default defineConfig({
  envDir: false,
  plugins: [react(), devApiPlugin()],
  build: {
    rollupOptions: {
      input: {
        app: fileURLToPath(new URL('./index.html', import.meta.url)),
        prototype: fileURLToPath(new URL('./prototypes/ui-directions/light-professional.html', import.meta.url))
      }
    }
  },
  test: {
    globals: true,
    environment: 'node'
  }
});
