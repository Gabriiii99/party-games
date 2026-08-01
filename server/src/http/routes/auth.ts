// Registrazione e accesso. Volutamente semplice: solo username e password, nessuna
// email e nessun vincolo sulla robustezza della password (scelta dell'utente).
//
// Registrazione e accesso sono due rotte SEPARATE anche se il frontend le mostra
// nella stessa schermata: un unico endpoint "accedi-o-registrati" creerebbe account
// per errore a chi sbaglia a digitare il proprio nome (o quello di un amico).

import { Router } from 'express'
import { z } from 'zod'
import { firmaToken } from '../../auth/jwt'
import { hashPassword, verificaPassword } from '../../auth/password'
import { getPrisma } from '../../prisma'
import { richiedeDatabase, richiedeLogin } from '../middleware/auth'

export const authRouter = Router()

// Nessun vincolo di complessita': solo limiti di lunghezza per sanita' mentale.
const credenziali = z.object({
  username: z.string().trim().min(1, 'Serve un nome.').max(24, 'Nome troppo lungo (max 24).'),
  password: z.string().min(1, 'Serve una password.').max(200),
})

authRouter.post('/auth/register', richiedeDatabase, async (req, res) => {
  const dati = credenziali.safeParse(req.body)
  if (!dati.success) {
    // Si mostra solo il primo messaggio: prettifyError aggiungerebbe simboli e nomi
    // dei campi, buoni per un log ma non per chi legge dallo schermo del telefono.
    res.status(400).json({
      error: 'invalid',
      message: dati.error.issues[0]?.message ?? 'Dati non validi.',
    })
    return
  }

  const { username, password } = dati.data
  const usernameLower = username.toLowerCase()
  const prisma = getPrisma()

  const esistente = await prisma.user.findUnique({ where: { usernameLower } })
  if (esistente) {
    res.status(409).json({
      error: 'username_occupato',
      message: `"${username}" è già preso. Scegline un altro o accedi.`,
    })
    return
  }

  const utente = await prisma.user.create({
    data: { username, usernameLower, passwordHash: await hashPassword(password) },
  })

  res.status(201).json({
    token: firmaToken({ userId: utente.id, username: utente.username }),
    utente: { id: utente.id, username: utente.username },
  })
})

authRouter.post('/auth/login', richiedeDatabase, async (req, res) => {
  const dati = credenziali.safeParse(req.body)
  if (!dati.success) {
    // Si mostra solo il primo messaggio: prettifyError aggiungerebbe simboli e nomi
    // dei campi, buoni per un log ma non per chi legge dallo schermo del telefono.
    res.status(400).json({
      error: 'invalid',
      message: dati.error.issues[0]?.message ?? 'Dati non validi.',
    })
    return
  }

  const { username, password } = dati.data
  const prisma = getPrisma()
  const utente = await prisma.user.findUnique({
    where: { usernameLower: username.toLowerCase() },
  })

  // Stesso messaggio per "utente inesistente" e "password sbagliata": non si rivela
  // quali nomi esistono.
  const passwordOk = utente ? await verificaPassword(password, utente.passwordHash) : false
  if (!utente || !passwordOk) {
    res.status(401).json({
      error: 'credenziali_errate',
      message: 'Nome o password non corretti.',
    })
    return
  }

  res.json({
    token: firmaToken({ userId: utente.id, username: utente.username }),
    utente: { id: utente.id, username: utente.username },
  })
})

/** Serve al client per capire, all'avvio, se il token salvato e' ancora valido. */
authRouter.get('/auth/me', richiedeLogin, (req, res) => {
  res.json({ utente: { id: req.utente!.userId, username: req.utente!.username } })
})
