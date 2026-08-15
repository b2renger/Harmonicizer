import { defineConfig } from 'vitest/config';

// Kept separate from vite.config.ts so test setup does not entangle with the app's
// build config. Vitest prefers this file when both are present.
export default defineConfig({
    test: {
        environment: 'node',
        include: ['**/__tests__/**/*.test.ts'],
        exclude: ['node_modules/**', 'dist/**'],
    },
});
