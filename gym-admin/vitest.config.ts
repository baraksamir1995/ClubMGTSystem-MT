import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  // Next's tsconfig sets `jsx: preserve` (Next compiles JSX itself);
  // vitest (rolldown/oxc) needs the automatic runtime to parse .tsx tests.
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
});
