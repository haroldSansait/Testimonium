import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Port is pinned to 5173 with strictPort to prevent silent port drift
// when running alongside the Admin Portal (5174) and Backend (5000).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true, // fail immediately on conflict instead of incrementing
  },
})
