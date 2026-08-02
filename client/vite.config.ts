import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Frontend su :5173. Le chiamate /api e il WebSocket vengono inoltrati al backend
// su :3000, cosi' in sviluppo non ci sono problemi di CORS e il client puo' usare
// sempre l'origine corrente (in produzione backend e frontend sono lo stesso server).
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt' e non 'autoUpdate': con l'aggiornamento automatico il browser
      // ricaricherebbe la pagina appena pubblichiamo una versione nuova, anche a
      // meta' partita. Cosi' invece la versione nuova resta in attesa e subentra
      // alla prossima apertura dell'app.
      registerType: 'prompt',
      injectRegister: 'script',

      manifest: {
        name: 'Party Games',
        short_name: 'Party Games',
        description: 'Giochi di gruppo da fare insieme, ognuno dal proprio telefono.',
        lang: 'it',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#12101c',
        theme_color: '#12101c',
        icons: [
          { src: 'icons/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            // Android ritaglia l'icona nella forma che preferisce: questa ha il
            // disegno raccolto al centro, per non farsi tagliare i bordi.
            src: 'icons/pwa-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },

      // Non finiscono nel manifest ma vanno copiate: le usano iOS e la scheda del browser.
      includeAssets: ['icons/apple-touch-icon.png', 'icons/favicon.ico'],

      workbox: {
        // Si mette in cache SOLO il guscio dell'app (codice, stili, icone). Domande,
        // partite e classifiche non si toccano: sono dati vivi, una copia vecchia
        // sarebbe peggio di nessuna copia.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Le richieste al server non devono mai essere servite dal guscio offline.
        navigateFallbackDenylist: [/^\/api/, /^\/socket\.io/],
        // Coerenti con registerType 'prompt': la versione nuova aspetta il suo turno
        // invece di prendere il controllo delle schede gia' aperte.
        skipWaiting: false,
        clientsClaim: false,
      },
    }),
  ],
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
