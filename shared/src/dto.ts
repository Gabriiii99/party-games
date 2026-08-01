// Oggetti scambiati tra server e client. Usati da entrambi i lati, cosi' un
// cambio di forma diventa subito un errore di compilazione invece di un bug a runtime.

import type { GameType } from './games'

// --- Utenti ------------------------------------------------------------------

export interface Utente {
  id: string
  username: string
}

export interface RispostaAuth {
  token: string
  utente: Utente
}

// --- Giocatori in partita ----------------------------------------------------

export interface PlayerPublic {
  userId: string
  nickname: string
  /** false = momentaneamente disconnesso, ma resta in partita col suo punteggio. */
  connected: boolean
  isHost: boolean
  /** true solo durante una domanda: ha gia' risposto (non si sa ancora se bene). */
  haRisposto: boolean
}

// --- Domande -----------------------------------------------------------------

export type QuestionType = 'MULTIPLE_CHOICE' | 'TRUE_FALSE'

/**
 * La domanda come la vede il client: NON contiene la risposta corretta, che
 * viene rivelata solo con l'evento `question:reveal`.
 */
export interface QuestionPublic {
  id: string
  type: QuestionType
  text: string
  options: string[]
}

// --- Classifica --------------------------------------------------------------

export interface ScoreboardRow {
  userId: string
  nickname: string
  /** Numero di risposte corrette: e' il punteggio. */
  correctCount: number
  /** Somma dei tempi di risposta (ms). Solo criterio di spareggio. */
  totalMs: number
  /** 1 = primo. Puo' ripetersi in caso di vero pari merito. */
  rank: number
}

// --- Stato della partita -----------------------------------------------------

export type FaseGioco = 'LOBBY' | 'QUESTION' | 'REVEAL' | 'PODIUM' | 'ENDED'

/** Riepilogo di una partita, usato dalla lobby e dagli snapshot di riconnessione. */
export interface StatoPartita {
  pin: string
  gameType: GameType
  fase: FaseGioco
  hostId: string
  timeLimitSec: number
  players: PlayerPublic[]
  /** Titolo del set di domande scelto. */
  titoloSet: string
  totalQuestions: number
}
