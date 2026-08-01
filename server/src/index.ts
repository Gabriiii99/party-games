// Punto di ingresso del backend.
// Un solo server HTTP a cui si agganciano sia Express sia (dalla Fase 2) Socket.IO.

import './loadEnv' // deve stare prima di tutto il resto
import { createServer } from 'node:http'
import { env } from './env'
import { creaApp } from './http/app'

const app = creaApp()
const httpServer = createServer(app)

// Fase 2: qui verra' agganciato Socket.IO sullo stesso httpServer.

// '0.0.0.0' e non 'localhost': serve su Render e per i test da altri dispositivi.
httpServer.listen(env.PORT, '0.0.0.0', () => {
  console.log(`[server] in ascolto su http://localhost:${env.PORT}  (${env.NODE_ENV})`)
})

// Chiusura ordinata: Render manda SIGTERM a ogni deploy.
for (const segnale of ['SIGINT', 'SIGTERM'] as const) {
  process.on(segnale, () => {
    console.log(`[server] ricevuto ${segnale}, chiudo...`)
    httpServer.close(() => process.exit(0))
  })
}
