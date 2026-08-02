// Elenco dei pacchetti di domande, per far scegliere all'host cosa giocare.
// La creazione e la modifica arrivano nella Fase 5: qui si legge soltanto.

import { Router } from 'express'
import { richiedeDatabase, richiedeLogin } from '../middleware/auth'
import { getPrisma } from '../../prisma'

export const questionSetsRouter = Router()

questionSetsRouter.get(
  '/question-sets',
  richiedeDatabase,
  richiedeLogin,
  async (req, res) => {
    const utente = req.utente!

    const set = await getPrisma().questionSet.findMany({
      // I pacchetti pubblici sono di tutti; quelli privati li vede solo chi li ha fatti.
      where: { OR: [{ isPublic: true }, { ownerId: utente.userId }] },
      select: {
        id: true,
        title: true,
        description: true,
        _count: { select: { questions: true } },
        owner: { select: { username: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    res.json({
      set: set.map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        numeroDomande: s._count.questions,
        autore: s.owner.username,
      })),
    })
  },
)
