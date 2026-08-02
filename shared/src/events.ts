// Contratto degli eventi Socket.IO: la fonte di verita' della comunicazione
// real-time. Server e client tipizzano i loro socket con queste interfacce, quindi
// un evento scritto male o un payload sbagliato non compila.
//
// Convenzione: ogni partita vive nella room Socket.IO `game:<PIN>`.

import type {
  FaseGioco,
  PlayerPublic,
  QuestionPublic,
  ScoreboardRow,
  StatoPartita,
} from './dto'
import type { GameType } from './games'

/** Nome della room Socket.IO di una partita. */
export function nomeRoom(pin: string): string {
  return `game:${pin}`
}

// --- Esiti delle richieste (callback di ack) ----------------------------------

export type CodiceErrore =
  | 'not_found' // PIN inesistente
  | 'in_progress' // partita gia' iniziata
  | 'not_host' // azione riservata all'host
  | 'not_enough_players'
  | 'invalid' // payload non valido
  | 'server_error'

export interface EsitoOk {
  ok: true
}

export interface EsitoErrore {
  ok: false
  error: CodiceErrore
  message?: string
}

/** Risposta a una richiesta che non restituisce dati. */
export type Esito = EsitoOk | EsitoErrore

/** Risposta a una richiesta che in caso di successo restituisce anche `T`. */
export type EsitoCon<T> = (EsitoOk & T) | EsitoErrore

// --- Client -> Server ---------------------------------------------------------

export interface ClientToServerEvents {
  /** Crea una partita e diventa host. Nello stato c'è il PIN da dettare agli amici. */
  'game:create': (
    payload: { gameType: GameType; questionSetId: string },
    ack: (esito: EsitoCon<{ stato: StatoPartita }>) => void,
  ) => void

  /** Entra in una partita in lobby. */
  'game:join': (
    payload: { pin: string },
    ack: (esito: EsitoCon<{ stato: StatoPartita }>) => void,
  ) => void

  /** Solo host: cambia i secondi per domanda mentre si e' in lobby. */
  'lobby:settings': (
    payload: { timeLimitSec: number },
    ack: (esito: Esito) => void,
  ) => void

  /** Solo host: chiude la lobby e fa partire la prima domanda. */
  'game:start': (ack: (esito: Esito) => void) => void

  /** Invia la risposta. Vale solo la prima per ogni domanda. */
  'answer:submit': (
    payload: { questionIndex: number; optionIndex: number },
    ack: (esito: Esito) => void,
  ) => void

  /** Solo host: salta l'attesa sulla schermata del risultato. */
  'game:next': (ack: (esito: Esito) => void) => void

  /** Rientra dopo una disconnessione: riceve `game:state` con la fase corrente. */
  'game:rejoin': (payload: { pin: string }, ack: (esito: Esito) => void) => void

  /** Uscita volontaria. */
  'game:leave': () => void
}

// --- Server -> Client ---------------------------------------------------------

export interface ServerToClientEvents {
  /**
   * Qualcuno e' entrato/uscito, o l'host ha cambiato il tempo.
   * Si manda sempre lo stato completo invece del solo pezzo cambiato: e' piccolo, e
   * cosi' il client non puo' andare fuori sincrono ricostruendo aggiornamenti parziali.
   */
  'lobby:update': (payload: { stato: StatoPartita }) => void

  /** La partita sta partendo: schermata "pronti?". */
  'game:starting': (payload: { totalQuestions: number }) => void

  /**
   * Nuova domanda. Il countdown si calcola sempre da `deadlineTs`:
   * `serverNow` serve al client per stimare lo scarto tra il proprio orologio e
   * quello del server (l'unico che conta).
   */
  'question:show': (payload: {
    index: number
    total: number
    question: QuestionPublic
    serverNow: number
    deadlineTs: number
    durationMs: number
  }) => void

  /** Conferma che la risposta e' stata registrata (o rifiutata perche' tardiva). */
  'answer:ack': (payload: { accepted: boolean; questionIndex: number }) => void

  /** Fine domanda: si scopre la risposta giusta e la classifica aggiornata. */
  'question:reveal': (payload: {
    questionIndex: number
    correctIndex: number
    /** null = non ha risposto. */
    yourAnswer: number | null
    yourCorrect: boolean
    /** Quante persone hanno scelto ciascuna opzione. */
    counts: number[]
    scoreboard: ScoreboardRow[]
    /** Secondi prima della domanda successiva (l'host puo' saltarli). */
    prossimaTraSec: number
    ultimaDomanda: boolean
  }) => void

  /** Partita finita: podio. */
  'game:over': (payload: {
    podium: ScoreboardRow[]
    totalQuestions: number
  }) => void

  /** Snapshot completo dopo un `game:rejoin`. */
  'game:state': (payload: {
    stato: StatoPartita
    fase: FaseGioco
    /** Presente solo se `fase === 'QUESTION'`. */
    domandaInCorso?: {
      index: number
      total: number
      question: QuestionPublic
      serverNow: number
      deadlineTs: number
      durationMs: number
      haGiaRisposto: boolean
    }
    scoreboard: ScoreboardRow[]
  }) => void

  /** L'host e' caduto: la partita va avanti da sola, ma i comandi non ci sono. */
  'host:disconnected': (payload: { graceMs: number }) => void
  'host:changed': (payload: { newHostId: string; nickname: string }) => void

  /** La partita e' stata chiusa dal server (nessuno collegato, errore grave...). */
  'game:closed': (payload: { motivo: string }) => void

  'game:error': (payload: { code: CodiceErrore; message: string }) => void
}

/** Dati che il server tiene attaccati a ogni socket autenticato. */
export interface SocketData {
  userId: string
  username: string
  /** PIN della partita a cui il socket e' agganciato. */
  pin?: string
}
