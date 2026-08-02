// Una partita, viva in memoria.
//
// Perche' in memoria e non nel database: una partita dura pochi minuti ed e' tutta
// "adesso" (chi e' collegato, chi ha gia' risposto, quanto manca). Scriverla su Neon
// a ogni evento sarebbe lento e inutile. Nel database finisce solo il risultato
// finale, a partita conclusa.
//
// L'identita' di un giocatore e' il suo `userId`, MAI il `socket.id`: il socket cambia
// a ogni riconnessione (succede di continuo su rete mobile), l'utente no. E' questa
// scelta che rende possibile rientrare in partita ritrovando il proprio punteggio.

import {
  TEMPO_DEFAULT,
  type FaseGioco,
  type GameType,
  type PlayerPublic,
  type StatoPartita,
  type TempoDisponibile,
} from '@party/shared'

export interface Giocatore {
  userId: string
  nickname: string
  /** false = momentaneamente scollegato, ma resta in partita col suo punteggio. */
  connected: boolean
  socketId: string | null
  /** Ordine di arrivo: se l'host cade, il testimone passa al piu' anziano collegato. */
  entratoIl: number
  correctCount: number
  totalMs: number
  /** Ha gia' risposto alla domanda in corso. */
  haRisposto: boolean
}

export interface OpzioniGameRoom {
  pin: string
  gameType: GameType
  hostId: string
  questionSetId: string
  titoloSet: string
  totalQuestions: number
}

export class GameRoom {
  readonly pin: string
  readonly gameType: GameType
  readonly questionSetId: string
  readonly titoloSet: string
  readonly totalQuestions: number
  readonly creataIl = Date.now()

  hostId: string
  timeLimitSec: TempoDisponibile = TEMPO_DEFAULT
  fase: FaseGioco = 'LOBBY'

  private readonly giocatori = new Map<string, Giocatore>()
  private contatoreArrivi = 0

  constructor(opzioni: OpzioniGameRoom) {
    this.pin = opzioni.pin
    this.gameType = opzioni.gameType
    this.hostId = opzioni.hostId
    this.questionSetId = opzioni.questionSetId
    this.titoloSet = opzioni.titoloSet
    this.totalQuestions = opzioni.totalQuestions
  }

  // --- Giocatori ---------------------------------------------------------------

  /** Entra, oppure rientra se era gia' dentro (in quel caso il punteggio resta). */
  aggiungi(userId: string, nickname: string, socketId: string): Giocatore {
    const esistente = this.giocatori.get(userId)
    if (esistente) {
      esistente.connected = true
      esistente.socketId = socketId
      esistente.nickname = nickname
      return esistente
    }

    const nuovo: Giocatore = {
      userId,
      nickname,
      connected: true,
      socketId,
      entratoIl: this.contatoreArrivi++,
      correctCount: 0,
      totalMs: 0,
      haRisposto: false,
    }
    this.giocatori.set(userId, nuovo)
    return nuovo
  }

  trova(userId: string): Giocatore | undefined {
    return this.giocatori.get(userId)
  }

  /**
   * Segna scollegato senza rimuovere: il giocatore puo' rientrare col suo punteggio.
   * In lobby invece si esce davvero, altrimenti resterebbero nomi grigi di gente
   * che ha solo sbagliato stanza.
   */
  segnaDisconnesso(userId: string): void {
    const g = this.giocatori.get(userId)
    if (!g) return

    if (this.fase === 'LOBBY') {
      this.giocatori.delete(userId)
      return
    }
    g.connected = false
    g.socketId = null
  }

  rimuovi(userId: string): void {
    this.giocatori.delete(userId)
  }

  get elenco(): Giocatore[] {
    return [...this.giocatori.values()].sort((a, b) => a.entratoIl - b.entratoIl)
  }

  get numeroGiocatori(): number {
    return this.giocatori.size
  }

  get numeroConnessi(): number {
    return this.elenco.filter((g) => g.connected).length
  }

  get vuota(): boolean {
    return this.numeroConnessi === 0
  }

  // --- Host ---------------------------------------------------------------------

  eHost(userId: string): boolean {
    return this.hostId === userId
  }

  /** Chi prende il comando se l'host non torna: il piu' anziano ancora collegato. */
  candidatoHost(): Giocatore | undefined {
    return this.elenco.find((g) => g.connected && g.userId !== this.hostId)
  }

  // --- Impostazioni --------------------------------------------------------------

  impostaTempo(secondi: TempoDisponibile): void {
    this.timeLimitSec = secondi
  }

  // --- Viste per il client ---------------------------------------------------------

  get elencoPubblico(): PlayerPublic[] {
    return this.elenco.map((g) => ({
      userId: g.userId,
      nickname: g.nickname,
      connected: g.connected,
      isHost: g.userId === this.hostId,
      haRisposto: g.haRisposto,
    }))
  }

  get stato(): StatoPartita {
    return {
      pin: this.pin,
      gameType: this.gameType,
      fase: this.fase,
      hostId: this.hostId,
      timeLimitSec: this.timeLimitSec,
      players: this.elencoPubblico,
      titoloSet: this.titoloSet,
      totalQuestions: this.totalQuestions,
    }
  }
}
