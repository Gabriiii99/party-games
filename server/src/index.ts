// Punto di ingresso del backend.
// Un solo server HTTP a cui si agganciano sia Express sia (dalla Fase 2) Socket.IO.

import './loadEnv' // deve stare prima di tutto il resto
import { createServer } from 'node:http'
import { env } from './env'
import { gameManager } from './game/GameManager'
import { creaApp } from './http/app'
import { creaIo } from './realtime/io'

const app = creaApp()
const httpServer = createServer(app)

// Stesso server HTTP: API, frontend e WebSocket viaggiano su una porta sola.
const io = creaIo(httpServer)

// Le partite abbandonate (tutti scollegati) non spariscono da sole: ogni tanto si
// fa pulizia, altrimenti terrebbero occupato il loro PIN fino al riavvio.
const pulizia = setInterval(
  () => {
    const rimosse = gameManager.pulisci()
    if (rimosse > 0) console.log(`[gioco] ripulite ${rimosse} partite abbandonate`)
  },
  10 * 60 * 1000,
)
pulizia.unref() // non deve tenere vivo il processo da solo

// '0.0.0.0' e non 'localhost': serve su Render e per i test da altri dispositivi.
httpServer.listen(env.PORT, '0.0.0.0', () => {
  console.log(`[server] in ascolto su http://localhost:${env.PORT}  (${env.NODE_ENV})`)
})

// Chiusura ordinata: Render manda SIGTERM a ogni deploy.
for (const segnale of ['SIGINT', 'SIGTERM'] as const) {
  process.on(segnale, () => {
    console.log(`[server] ricevuto ${segnale}, chiudo...`)
    // Prima i socket: avvisa i telefoni collegati invece di lasciarli appesi.
    io.close(() => httpServer.close(() => process.exit(0)))
  })
}
