// Endpoint di servizio: dice se il backend e' vivo.
// Usato dal client nella schermata iniziale e (in futuro) per svegliare l'app su Render.

import { Router } from 'express'

export const healthRouter = Router()

const avvioTs = Date.now()

healthRouter.get('/health', (_req, res) => {
  res.json({
    ok: true,
    servizio: 'party-games',
    versione: '0.1.0',
    uptimeSec: Math.round((Date.now() - avvioTs) / 1000),
  })
})
