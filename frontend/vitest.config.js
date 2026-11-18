import { defineConfig } from '@tsek/test-runner/config';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()], test: { environment: 'jsdom', include: ['tests/*.test.tsx'], setupFiles: ['tests/setup.js'] } });
