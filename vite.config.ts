import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  root: 'src/renderer',
  base: './',
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/renderer/index.html'),
        ranking: resolve(__dirname, 'src/renderer/ranking.html'),
      },
      output: {
        assetFileNames: `assets/[name][extname]`,
        entryFileNames: `[name].js`, // Ensure separate JS files for each entry
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@shared': resolve(__dirname, 'src/shared'),
      '@renderer': resolve(__dirname, 'src/renderer'),
      '@main': resolve(__dirname, 'src/main')
    }
  },
  server: {
    port: 3000,
    strictPort: true
  },
  publicDir: resolve(__dirname, 'assets')
})