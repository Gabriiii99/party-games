// Middleware di autenticazione per le rotte REST.
// Legge l'header "Authorization: Bearer <token>" e attacca l'utente alla richiesta.

import type { NextFunction, Request, Response } from 'express'
import { verificaToken, type DatiToken } from '../../auth/jwt'
import { databaseConfigurato } from '../../prisma'

// Aggiunge il campo `utente` al tipo Request di Express.
declare global {
  namespace Express {
    interface Request {
      utente?: DatiToken
    }
  }
}

/** Blocca la richiesta con 401 se il token manca o non e' valido. */
export function richiedeLogin(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null

  const dati = token ? verificaToken(token) : null
  if (!dati) {
    res.status(401).json({ error: 'non_autenticato', message: 'Devi accedere.' })
    return
  }

  req.utente = dati
  next()
}

/**
 * Blocca la richiesta con 503 se il database non e' ancora configurato, spiegando
 * cosa fare. Utile finche' le stringhe di Neon non sono nel .env.
 */
export function richiedeDatabase(_req: Request, res: Response, next: NextFunction): void {
  if (!databaseConfigurato) {
    res.status(503).json({
      error: 'database_non_configurato',
      message:
        'Database non configurato: copia .env.example in .env e incolla le due stringhe di Neon.',
    })
    return
  }
  next()
}
