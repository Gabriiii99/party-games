// Il regista del quiz: decide quando si apre una domanda, quando si chiude e quando
// si passa alla successiva.
//
// Tutto il ritmo lo tiene il server. Il telefono non decide mai nulla: mostra la
// domanda, manda la risposta e aspetta. È questa asimmetria che rende impossibile
// guadagnare tempo cambiando l'orologio del telefono o rispondendo dopo la scadenza.

import { GRAZIA_MS, nomeRoom, PAUSA_REVEAL_SEC } from '@party/shared'
import { getPrisma } from '../prisma'
import type { ServerIO } from '../realtime/io'
import type { GameRoom } from './GameRoom'

/** Pausa tra il "via" e la prima domanda: il tempo di prendere in mano il telefono. */
const ATTESA_PARTENZA_MS = 3000

/** Carica dal database le domande del set scelto, in ordine. */
export async function caricaDomande(stanza: GameRoom): Promise<number> {
  const domande = await getPrisma().question.findMany({
    where: { questionSetId: stanza.questionSetId },
    orderBy: { order: 'asc' },
    select: {
      id: true,
      type: true,
      text: true,
      options: true,
      correctIndex: true,
      timeLimitSec: true,
    },
  })

  stanza.caricaDomande(domande)
  return domande.length
}

/** Chiude la lobby e fa partire il conto alla rovescia della prima domanda. */
export function avviaPartita(io: ServerIO, stanza: GameRoom): void {
  io.to(nomeRoom(stanza.pin)).emit('game:starting', {
    totalQuestions: stanza.numeroDomande,
  })
  stanza.programma(() => mostraProssimaDomanda(io, stanza), ATTESA_PARTENZA_MS)
}

export function mostraProssimaDomanda(io: ServerIO, stanza: GameRoom): void {
  const apertura = stanza.apriProssimaDomanda()
  if (!apertura) {
    concludiPartita(io, stanza)
    return
  }

  const pubblica = stanza.domandaPubblica
  if (!pubblica) {
    concludiPartita(io, stanza)
    return
  }

  io.to(nomeRoom(stanza.pin)).emit('question:show', {
    index: stanza.indiceCorrente,
    total: stanza.numeroDomande,
    question: pubblica,
    // serverNow permette al client di misurare quanto è avanti o indietro il proprio
    // orologio, e calcolare il tempo rimasto rispetto a quello del server.
    serverNow: Date.now(),
    deadlineTs: apertura.deadlineTs,
    durationMs: apertura.durataMs,
  })

  // La grazia evita di tagliare fuori chi ha risposto in tempo ma con la rete lenta.
  stanza.programma(() => chiudiDomanda(io, stanza), apertura.durataMs + GRAZIA_MS)
}

export function chiudiDomanda(io: ServerIO, stanza: GameRoom): void {
  const domanda = stanza.domandaCorrente
  if (!domanda || stanza.fase !== 'QUESTION') return

  stanza.chiudiDomanda()

  const classifica = stanza.classifica
  const conteggi = stanza.conteggioRisposte
  const ultima = stanza.ultimaDomanda

  // La rivelazione è personalizzata (cosa hai risposto TU), quindi si manda a ogni
  // giocatore separatamente invece che a tutta la stanza.
  for (const giocatore of stanza.elenco) {
    if (!giocatore.socketId) continue
    const sua = stanza.rispostaDi(giocatore.userId)
    io.to(giocatore.socketId).emit('question:reveal', {
      questionIndex: stanza.indiceCorrente,
      correctIndex: domanda.correctIndex,
      yourAnswer: sua?.optionIndex ?? null,
      yourCorrect: sua?.corretta ?? false,
      counts: conteggi,
      scoreboard: classifica,
      prossimaTraSec: PAUSA_REVEAL_SEC,
      ultimaDomanda: ultima,
    })
  }

  stanza.programma(() => {
    if (ultima) concludiPartita(io, stanza)
    else mostraProssimaDomanda(io, stanza)
  }, PAUSA_REVEAL_SEC * 1000)
}

/** L'host salta l'attesa sulla schermata del risultato. */
export function saltaAttesa(io: ServerIO, stanza: GameRoom): void {
  if (stanza.fase !== 'REVEAL') return
  stanza.annullaTimer()
  if (stanza.ultimaDomanda) concludiPartita(io, stanza)
  else mostraProssimaDomanda(io, stanza)
}

export function concludiPartita(io: ServerIO, stanza: GameRoom): void {
  stanza.concludi()
  io.to(nomeRoom(stanza.pin)).emit('game:over', {
    podium: stanza.classifica,
    totalQuestions: stanza.numeroDomande,
  })
}
