import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/mini-game/' : '/',
  server: { host: '0.0.0.0' },
}));
