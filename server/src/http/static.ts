// In produzione un solo processo serve tutto: le API, il WebSocket e la build
// del frontend. Un solo URL da dare agli amici, e nessun problema di CORS.
// In sviluppo questa funzione non fa nulla: il frontend lo serve Vite su :5173.

import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express, { type Express } from 'express'

const qui = path.dirname(fileURLToPath(import.meta.url))
const cartellaDist = path.resolve(qui, '../../../client/dist')

export function montaClientStatico(app: Express): void {
  if (!existsSync(cartellaDist)) {
    console.log('[static] client/dist assente: il frontend arriva da Vite (sviluppo)')
    return
  }

  app.use(express.static(cartellaDist))

  // Fallback per la single-page app: ogni rotta non-API restituisce index.html,
  // cosi' il routing lato client funziona anche ricaricando la pagina.
  // Nota: si usa app.use e non app.get('*') perche' in Express 5 il pattern '*'
  // non e' piu' valido.
  app.use((req, res) => {
    // Un percorso con estensione (.js, .png, .webmanifest) e' la richiesta di un
    // FILE: se non esiste deve dirlo. Rispondere con la pagina anche a queste
    // richieste fa sembrare presente qualsiasi file, e un file mancante si scopre
    // solo molto piu' tardi, quando qualcosa non funziona senza spiegazione.
    if (path.extname(req.path) !== '') {
      res.status(404).type('text/plain').send('File non trovato.')
      return
    }
    res.sendFile(path.join(cartellaDist, 'index.html'))
  })

  console.log(`[static] frontend servito da ${cartellaDist}`)
}
