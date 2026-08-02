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
  ordinaClassifica,
  TEMPO_DEFAULT,
  type FaseGioco,
  type GameType,
  type PlayerPublic,
  type QuestionPublic,
  type ScoreboardRow,
  type StatoPartita,
  type TempoDisponibile,
} from '@party/shared'

/** Una domanda come la conosce il server: qui dentro c'è anche la risposta giusta. */
export interface DomandaInterna {
  id: string
  type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE'
  text: string
  options: string[]
  correctIndex: number
  /** Se valorizzato vince sul tempo scelto dall'host per questa singola domanda. */
  timeLimitSec: number | null
}

export interface RispostaData {
  optionIndex: number
  /** Millisecondi dall'apparizione della domanda, misurati dal server. */
  tempoMs: number
  corretta: boolean
}

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

  // --- Stato del ciclo delle domande ---
  private domande: DomandaInterna[] = []
  /** Indice della domanda in corso; -1 finché non si è partiti. */
  private indice = -1
  private inizioTs = 0
  private scadenzaTs = 0
  private durataMs = 0
  private risposte = new Map<string, RispostaData>()
  /** Timer della domanda o della pausa: va sempre annullato prima di sostituirlo. */
  private timer: ReturnType<typeof setTimeout> | null = null
  /** Attesa del capo partita caduto, indipendente dal ritmo del gioco. */
  private timerHost: ReturnType<typeof setTimeout> | null = null
  /** Impedisce di scrivere due volte lo stesso risultato nell'albo d'oro. */
  private risultatiSalvati = false

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

  // --- Ciclo delle domande ------------------------------------------------------------

  caricaDomande(domande: DomandaInterna[]): void {
    this.domande = domande
  }

  get domandaCorrente(): DomandaInterna | undefined {
    return this.domande[this.indice]
  }

  get indiceCorrente(): number {
    return this.indice
  }

  get ultimaDomanda(): boolean {
    return this.indice >= this.domande.length - 1
  }

  get numeroDomande(): number {
    return this.domande.length
  }

  /**
   * Apre la domanda successiva e fissa la scadenza. Il momento di chiusura lo decide
   * il server e viene comunicato ai client: loro mostrano solo il conto alla rovescia,
   * non decidono quando è scaduto.
   */
  apriProssimaDomanda(): { domanda: DomandaInterna; deadlineTs: number; durataMs: number } | null {
    if (this.indice >= this.domande.length - 1) return null

    this.indice++
    const domanda = this.domande[this.indice]

    this.fase = 'QUESTION'
    this.risposte = new Map()
    for (const g of this.giocatori.values()) g.haRisposto = false

    this.durataMs = (domanda.timeLimitSec ?? this.timeLimitSec) * 1000
    this.inizioTs = Date.now()
    this.scadenzaTs = this.inizioTs + this.durataMs

    return { domanda, deadlineTs: this.scadenzaTs, durataMs: this.durataMs }
  }

  /** La domanda in corso, ripulita della risposta giusta: questa va al client. */
  get domandaPubblica(): QuestionPublic | null {
    const d = this.domandaCorrente
    if (!d) return null
    return { id: d.id, type: d.type, text: d.text, options: d.options }
  }

  get scadenza(): number {
    return this.scadenzaTs
  }

  get durataDomandaMs(): number {
    return this.durataMs
  }

  /**
   * Registra una risposta. Vale solo la prima di ogni giocatore: i tap doppi e i
   * ripensamenti vengono ignorati invece di sovrascrivere.
   */
  registraRisposta(
    userId: string,
    questionIndex: number,
    optionIndex: number,
    graziaMs: number,
  ): { accettata: boolean; motivo?: 'tardiva' | 'doppia' | 'fuori_fase' } {
    const domanda = this.domandaCorrente
    if (this.fase !== 'QUESTION' || !domanda || questionIndex !== this.indice) {
      return { accettata: false, motivo: 'fuori_fase' }
    }
    if (this.risposte.has(userId)) return { accettata: false, motivo: 'doppia' }

    const ora = Date.now()
    if (ora > this.scadenzaTs + graziaMs) return { accettata: false, motivo: 'tardiva' }

    const giocatore = this.giocatori.get(userId)
    if (!giocatore) return { accettata: false, motivo: 'fuori_fase' }

    // Il tempo si ferma alla scadenza: la tolleranza di rete non deve diventare
    // un tempo di risposta peggiore di chi ha risposto giusto in extremis.
    const tempoMs = Math.min(ora - this.inizioTs, this.durataMs)
    const corretta = optionIndex === domanda.correctIndex

    this.risposte.set(userId, { optionIndex, tempoMs, corretta })
    giocatore.haRisposto = true

    if (corretta) {
      giocatore.correctCount++
      // Si somma solo il tempo delle risposte GIUSTE: altrimenti chi sbaglia in fretta
      // guadagnerebbe posizioni nello spareggio rispetto a chi pensa e indovina.
      giocatore.totalMs += tempoMs
    }

    return { accettata: true }
  }

  /** Tutti i presenti hanno risposto: inutile far scorrere il cronometro a vuoto. */
  get tuttiHannoRisposto(): boolean {
    const connessi = this.elenco.filter((g) => g.connected)
    return connessi.length > 0 && connessi.every((g) => this.risposte.has(g.userId))
  }

  rispostaDi(userId: string): RispostaData | undefined {
    return this.risposte.get(userId)
  }

  /** Quante persone hanno scelto ciascuna opzione: si mostra alla rivelazione. */
  get conteggioRisposte(): number[] {
    const domanda = this.domandaCorrente
    if (!domanda) return []
    const conteggio = new Array<number>(domanda.options.length).fill(0)
    for (const r of this.risposte.values()) {
      if (r.optionIndex >= 0 && r.optionIndex < conteggio.length) conteggio[r.optionIndex]++
    }
    return conteggio
  }

  chiudiDomanda(): void {
    this.fase = 'REVEAL'
    this.annullaTimer()
  }

  concludi(): void {
    this.fase = 'PODIUM'
    this.annullaTimer()
  }

  /** true la prima volta soltanto: serve a non duplicare la riga nell'albo d'oro. */
  segnaRisultatiSalvati(): boolean {
    if (this.risultatiSalvati) return false
    this.risultatiSalvati = true
    return true
  }

  get classifica(): ScoreboardRow[] {
    return ordinaClassifica(
      this.elenco.map((g) => ({
        userId: g.userId,
        nickname: g.nickname,
        correctCount: g.correctCount,
        totalMs: g.totalMs,
      })),
    )
  }

  // --- Timer -----------------------------------------------------------------------

  programma(azione: () => void, ritardoMs: number): void {
    this.annullaTimer()
    this.timer = setTimeout(azione, ritardoMs)
  }

  annullaTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  /**
   * Timer separato per l'attesa del capo partita caduto: se usasse lo stesso della
   * domanda, far partire un'attesa cancellerebbe il cronometro della domanda in corso.
   */
  programmaAttesaHost(azione: () => void, ritardoMs: number): void {
    this.annullaAttesaHost()
    this.timerHost = setTimeout(azione, ritardoMs)
  }

  annullaAttesaHost(): void {
    if (this.timerHost) {
      clearTimeout(this.timerHost)
      this.timerHost = null
    }
  }

  get attesaHostInCorso(): boolean {
    return this.timerHost !== null
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

  /**
   * Tutto quello che serve a un telefono per rimettersi in pari dopo una caduta di
   * linea o un ricaricamento della pagina. È personalizzata perché "hai già risposto"
   * dipende da chi chiede.
   */
  fotografiaPer(userId: string): {
    stato: StatoPartita
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
  } {
    const base = { stato: this.stato, scoreboard: this.classifica }

    const domanda = this.domandaPubblica
    if (this.fase !== 'QUESTION' || !domanda) return base

    return {
      ...base,
      domandaInCorso: {
        index: this.indice,
        total: this.domande.length,
        question: domanda,
        // Il tempo che resta lo ricava il client da deadlineTs: chi rientra a metà
        // domanda riprende con i secondi giusti, non con il cronometro da capo.
        serverNow: Date.now(),
        deadlineTs: this.scadenzaTs,
        durationMs: this.durataMs,
        haGiaRisposto: this.risposte.has(userId),
      },
    }
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
