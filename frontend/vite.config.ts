import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
    port: 3000,
    proxy: {
        '/upload-url': 'http://backend:8080',
        '/pubsub-webhook': 'http://backend:8080',
        '/chat': 'http://backend:8080'
    }
  }
})
