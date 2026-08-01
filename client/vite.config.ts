import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Frontend su :5173. Le chiamate /api e il WebSocket vengono inoltrati al backend
// su :3000, cosi' in sviluppo non ci sono problemi di CORS e il client puo' usare
// sempre l'origine corrente (in produzione backend e frontend sono lo stesso server).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // ws: true e' indispensabile, altrimenti il WebSocket di Socket.IO non passa.
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
