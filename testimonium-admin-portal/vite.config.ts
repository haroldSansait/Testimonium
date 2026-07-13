import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
// Port is pinned to 5174 with strictPort to prevent silent port drift
// when running alongside the Parishioner Portal (5173) and Backend (5000).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5174,
    strictPort: true, // fail immediately on conflict instead of incrementing
  },
})

