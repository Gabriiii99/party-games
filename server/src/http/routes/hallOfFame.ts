// Albo d'oro: cosa resta delle serate passate.
//
// Due letture diverse della stessa storia: una classifica generale di chi vince più
// spesso, e l'elenco delle ultime partite per ricordarsi com'era finita.

import { Router } from 'express'
import { getPrisma } from '../../prisma'
import { richiedeDatabase, richiedeLogin } from '../middleware/auth'

export const hallOfFameRouter = Router()

/** Quante partite recenti mostrare: è un ricordo, non un archivio. */
const ULTIME_PARTITE = 8

hallOfFameRouter.get('/hall-of-fame', richiedeDatabase, richiedeLogin, async (_req, res) => {
  const prisma = getPrisma()

  // Le aggregazioni le fa il database: portare in memoria tutte le righe per contarle
  // funzionerebbe oggi con quattro amici, ma è il tipo di scorciatoia che poi resta.
  const [totali, vittorie, ultime] = await Promise.all([
    prisma.gameResult.groupBy({
      by: ['userId'],
      where: { userId: { not: null } },
      _count: { _all: true },
      _sum: { correctCount: true, totalQuestions: true },
    }),
    prisma.gameResult.groupBy({
      by: ['userId'],
      where: { userId: { not: null }, rank: 1 },
      _count: { _all: true },
    }),
    prisma.game.findMany({
      orderBy: { startedAt: 'desc' },
      take: ULTIME_PARTITE,
      select: {
        id: true,
        startedAt: true,
        questionSet: { select: { title: true } },
        results: {
          orderBy: { rank: 'asc' },
          select: { nickname: true, correctCount: true, rank: true },
        },
      },
    }),
  ])

  const idUtenti = totali.map((r) => r.userId).filter((id): id is string => id !== null)
  const utenti = await prisma.user.findMany({
    where: { id: { in: idUtenti } },
    select: { id: true, username: true },
  })
  const nomePerId = new Map(utenti.map((u) => [u.id, u.username]))
  const vittoriePerId = new Map(vittorie.map((v) => [v.userId, v._count._all]))

  const giocatori = totali
    .filter((r) => r.userId !== null && nomePerId.has(r.userId))
    .map((r) => ({
      userId: r.userId as string,
      username: nomePerId.get(r.userId as string) as string,
      partite: r._count._all,
      vittorie: vittoriePerId.get(r.userId) ?? 0,
      corrette: r._sum.correctCount ?? 0,
      domande: r._sum.totalQuestions ?? 0,
    }))
    // Prima chi vince di più; a parità chi ha più risposte giuste in assoluto.
    .sort(
      (a, b) =>
        b.vittorie - a.vittorie ||
        b.corrette - a.corrette ||
        a.username.localeCompare(b.username, 'it'),
    )

  res.json({
    giocatori,
    partite: ultime.map((p) => ({
      id: p.id,
      quando: p.startedAt,
      titoloSet: p.questionSet?.title ?? null,
      numeroGiocatori: p.results.length,
      vincitori: p.results.filter((r) => r.rank === 1).map((r) => r.nickname),
      punteggioVincente: p.results.find((r) => r.rank === 1)?.correctCount ?? 0,
    })),
  })
})
