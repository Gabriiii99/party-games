// Collegamento WebSocket al server.
//
// Una sola istanza per tutta l'app: aprirne una per pagina significherebbe comparire
// due volte nella stessa lobby. Si connette all'origine corrente, quindi in sviluppo
// passa dal proxy di Vite e in produzione va diretta: nessun indirizzo da configurare.

import type { ClientToServerEvents, ServerToClientEvents } from '@party/shared'
import { io, type Socket } from 'socket.io-client'
import { leggiToken } from './api'

export type SocketClient = Socket<ServerToClientEvents, ClientToServerEvents>

let istanza: SocketClient | null = null

export function getSocket(): SocketClient {
  if (istanza) return istanza

  istanza = io({
    // Ci si collega quando serve (dopo l'accesso), non al caricamento della pagina.
    autoConnect: false,
    // `auth` come funzione e non come oggetto: viene rivalutata a ogni riconnessione,
    // quindi dopo un nuovo accesso il socket usa subito il token nuovo. Con un oggetto
    // fisso resterebbe attaccato per sempre a quello letto la prima volta.
    auth: (cb) => cb({ token: leggiToken() ?? '' }),
    // La rete del telefono cade spesso: si riprova a lungo, con attese crescenti.
    reconnectionDelay: 500,
    reconnectionDelayMax: 4000,
  })

  return istanza
}

export function scollegaSocket(): void {
  istanza?.disconnect()
}
