// Regole di punteggio. Il tempo NON influisce sui punti: serve solo come spareggio.
//
//   risposta corretta            -> +1 punto
//   sbagliata o nessuna risposta ->  0 punti
//
// La classifica ordina per numero di risposte corrette; a parita' vince chi ha
// il tempo di risposta totale piu' basso (misurato dal server, non dal client).

import type { ScoreboardRow } from './dto'

/** Punti assegnati per una risposta corretta. */
export const PUNTI_CORRETTA = 1

/** Durate selezionabili dall'host in lobby (secondi per domanda). */
export const TEMPI_DISPONIBILI = [20, 30, 40, 60] as const
export type TempoDisponibile = (typeof TEMPI_DISPONIBILI)[number]

/** Durata proposta di default quando si crea una partita. */
export const TEMPO_DEFAULT: TempoDisponibile = 30

/**
 * Margine di tolleranza (ms) oltre la scadenza entro cui il server accetta
 * ancora una risposta, per non punire la latenza di rete.
 */
export const GRAZIA_MS = 400

/** Secondi di pausa sulla schermata del risultato prima della domanda successiva. */
export const PAUSA_REVEAL_SEC = 5

/**
 * Quanto si aspetta il capo partita caduto prima di passare il comando a un altro.
 * In galleria o cambiando cella si sta fuori qualche secondo: promuovere subito
 * significherebbe togliergli i comandi per un buco di rete di cui non ha colpa.
 */
export const GRAZIA_HOST_MS = 45000

export function tempoValido(sec: number): sec is TempoDisponibile {
  return (TEMPI_DISPONIBILI as readonly number[]).includes(sec)
}

/**
 * Ordina la classifica: piu' risposte corrette prima; a parita' tempo totale
 * piu' basso prima; come ultimo criterio il nome, per avere un ordine stabile.
 * Assegna `rank` gestendo i veri pari merito (stesse corrette E stesso tempo).
 */
export function ordinaClassifica(
  righe: readonly Omit<ScoreboardRow, 'rank'>[],
): ScoreboardRow[] {
  const ordinate = [...righe].sort((a, b) => {
    if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount
    if (a.totalMs !== b.totalMs) return a.totalMs - b.totalMs
    return a.nickname.localeCompare(b.nickname, 'it')
  })

  let rankCorrente = 0
  let precedente: Omit<ScoreboardRow, 'rank'> | undefined
  return ordinate.map((riga, i) => {
    const identica =
      precedente !== undefined &&
      precedente.correctCount === riga.correctCount &&
      precedente.totalMs === riga.totalMs
    if (!identica) rankCorrente = i + 1
    precedente = riga
    return { ...riga, rank: rankCorrente }
  })
}

/** "42.3s" — formattazione del tempo di spareggio. */
export function formattaTempo(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`
}
