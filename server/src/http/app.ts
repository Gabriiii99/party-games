// Composizione dell'app Express. L'ordine di registrazione conta:
//   1. le rotte /api
//   2. il 404 delle API (per non farle finire nel fallback della SPA)
//   3. i file statici del frontend + fallback index.html (solo in produzione)
//   4. il gestore degli errori, che va SEMPRE per ultimo: Express cerca il primo
//      gestore d'errore che viene DOPO il punto in cui l'errore e' avvenuto.

import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from 'express'
import { authRouter } from './routes/auth'
import { healthRouter } from './routes/health'
import { questionSetsRouter } from './routes/questionSets'
import { montaClientStatico } from './static'

export function creaApp(): Express {
  const app = express()

  app.use(express.json({ limit: '256kb' }))

  app.use('/api', healthRouter)
  app.use('/api', authRouter)
  app.use('/api', questionSetsRouter)

  app.use('/api', (_req, res) => {
    res.status(404).json({ ok: false, error: 'not_found' })
  })

  montaClientStatico(app)

  // Rete di sicurezza: un errore dentro una rotta non deve far cadere il processo
  // (e con lui le partite in corso). In Express 5 anche le promise rifiutate dalle
  // rotte async finiscono qui automaticamente.
  app.use((errore: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[api] errore non gestito:', errore)
    if (!res.headersSent) {
      res.status(500).json({ error: 'server_error', message: 'Errore interno.' })
    }
  })

  return app
}
