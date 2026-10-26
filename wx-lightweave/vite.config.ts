import { defineConfig } from 'vite';

// 浏览器预览：与真机共用 @pocket-play/lightweave 的同一份玩法代码。
export default defineConfig({
  base: './',
  server: {
    host: '127.0.0.1',
    port: 5275,
    strictPort: false,
  },
  build: {
    outDir: 'dist/web',
    emptyOutDir: true,
    target: 'es2019',
  },
  optimizeDeps: {
    exclude: ['@pocket-play/lightweave', '@pocket-play/engine'],
  },
});
