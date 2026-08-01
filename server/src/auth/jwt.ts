// Token di sessione (JWT). Il client lo salva e lo rimanda a ogni richiesta REST e
// nell'handshake del WebSocket, cosi' ogni messaggio e' attribuibile a un utente.

import jwt from 'jsonwebtoken'
import { env } from '../env'

/** Scadenza lunga: gli amici non devono rifare il login ogni sera. */
const DURATA = '30d'

export interface DatiToken {
  userId: string
  username: string
}

export function firmaToken(dati: DatiToken): string {
  return jwt.sign({ sub: dati.userId, username: dati.username }, env.JWT_SECRET, {
    expiresIn: DURATA,
  })
}

/** Restituisce i dati dell'utente, oppure null se il token e' assente/scaduto/falso. */
export function verificaToken(token: string): DatiToken | null {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET)
    if (
      typeof payload === 'object' &&
      payload !== null &&
      typeof payload.sub === 'string' &&
      typeof (payload as { username?: unknown }).username === 'string'
    ) {
      return {
        userId: payload.sub,
        username: (payload as { username: string }).username,
      }
    }
    return null
  } catch {
    return null
  }
}
