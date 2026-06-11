import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' so the built site works from any path on a static kiosk server
export default defineConfig({
  plugins: [react()],
  base: './',
})
