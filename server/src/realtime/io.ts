// Creazione del server WebSocket e riconoscimento di chi si collega.
//
// Socket.IO si aggancia allo STESSO server HTTP di Express: un solo processo, una sola
// porta, un solo indirizzo da dare agli amici. In sviluppo il browser parla con Vite
// su :5173, che inoltra qui: anche li' quindi e' tutto "stessa origine" e non serve
// configurare la CORS.

import type { Server as HttpServer } from 'node:http'
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from '@party/shared'
import { Server, type Socket } from 'socket.io'
import { verificaToken } from '../auth/jwt'
import { registraHandler } from './handlers'

/** Non ci sono eventi tra un server e l'altro: gira tutto in un processo solo. */
type EventiInterServer = Record<string, never>

export type ServerIO = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  EventiInterServer,
  SocketData
>

export type SocketPartita = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  EventiInterServer,
  SocketData
>

export function creaIo(httpServer: HttpServer): ServerIO {
  const io: ServerIO = new Server(httpServer, {
    // Il client arriva dal bundle di Vite: non serve che Socket.IO serva il proprio.
    serveClient: false,
    // Rete mobile: si tollera qualche secondo di silenzio prima di dichiarare caduto
    // un giocatore, altrimenti un tunnel o un cambio cella lo butterebbe fuori.
    pingTimeout: 25000,
    pingInterval: 20000,
  })

  // Nessun socket anonimo: il token viene verificato durante l'handshake, prima che
  // il collegamento sia accettato. Cosi' ogni messaggio che arrivera' dopo ha gia' un
  // utente riconosciuto, e nessun evento deve piu' chiedersi "chi me lo manda?".
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token
    if (typeof token !== 'string' || token.length === 0) {
      next(new Error('token mancante'))
      return
    }

    const dati = verificaToken(token)
    if (!dati) {
      next(new Error('token non valido o scaduto'))
      return
    }

    socket.data.userId = dati.userId
    socket.data.username = dati.username
    next()
  })

  io.on('connection', (socket) => {
    registraHandler(io, socket)
  })

  return io
}
