import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// The `@/` path alias from tsconfig, so tests can import app code (server actions) that uses it.
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
});
