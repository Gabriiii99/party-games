// Scrittura del risultato finale nel database: è l'unico momento in cui una partita
// tocca Neon. Durante il gioco si scriverebbe decine di volte per nulla; qui si scrive
// una volta sola, quando c'è qualcosa che vale la pena ricordare.

import { getPrisma } from '../prisma'
import type { GameRoom } from './GameRoom'

/**
 * Salva partita e classifica finale. Non solleva mai: se il database fa i capricci,
 * i giocatori devono comunque vedere il loro podio. Si perde una riga di storico,
 * non la serata.
 */
export async function salvaRisultati(stanza: GameRoom): Promise<void> {
  if (!stanza.segnaRisultatiSalvati()) return

  const classifica = stanza.classifica
  if (classifica.length === 0) return

  try {
    const prisma = getPrisma()

    // Una transazione sola: o si salva la partita con tutte le sue righe, o niente.
    // Una partita senza classifica nell'albo d'oro sarebbe peggio di nessuna partita.
    await prisma.game.create({
      data: {
        pin: stanza.pin,
        gameType: stanza.gameType,
        hostId: stanza.hostId,
        questionSetId: stanza.questionSetId,
        endedAt: new Date(),
        results: {
          create: classifica.map((riga) => ({
            userId: riga.userId,
            nickname: riga.nickname,
            correctCount: riga.correctCount,
            totalQuestions: stanza.numeroDomande,
            totalMs: riga.totalMs,
            rank: riga.rank,
          })),
        },
      },
    })

    console.log(
      `[albo] partita ${stanza.pin} archiviata: ${classifica
        .map((r) => `${r.nickname} ${r.correctCount}`)
        .join(', ')}`,
    )
  } catch (errore) {
    console.error(`[albo] non sono riuscito a salvare la partita ${stanza.pin}:`, errore)
  }
}
