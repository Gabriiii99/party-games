// Stato della partita, condiviso da tutte le schermate.
//
// Il client non tiene una propria idea di come vanno le cose: riceve dal server lo
// stato e lo mostra. Quale schermata far vedere non è una decisione del telefono, è
// una conseguenza degli eventi che arrivano.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type {
  Esito,
  EsitoCon,
  GameType,
  QuestionPublic,
  ScoreboardRow,
  StatoPartita,
  TempoDisponibile,
} from '@party/shared'
import { useAuth } from './auth'
import { getSocket, scollegaSocket } from './socket'

/** La domanda in corso, con quel che serve al conto alla rovescia. */
export interface DomandaInCorso {
  index: number
  total: number
  question: QuestionPublic
  deadlineTs: number
  durationMs: number
  /** Quanto l'orologio del telefono è avanti/indietro rispetto a quello del server. */
  scartoMs: number
}

export interface Rivelazione {
  questionIndex: number
  correctIndex: number
  yourAnswer: number | null
  yourCorrect: boolean
  counts: number[]
  scoreboard: ScoreboardRow[]
  prossimaTraSec: number
  ultimaDomanda: boolean
}

export interface Finale {
  podium: ScoreboardRow[]
  totalQuestions: number
}

/** Quale schermata mostrare: la decide la sequenza degli eventi del server. */
export type Schermata =
  | 'fuori'
  | 'lobby'
  | 'partenza'
  | 'domanda'
  | 'risultato'
  | 'podio'
  /** Rientrati tra una domanda e l'altra: si aspetta la prossima, arriva in pochi secondi. */
  | 'attesa'

interface ContestoPartita {
  collegato: boolean
  stato: StatoPartita | null
  schermata: Schermata
  domanda: DomandaInCorso | null
  /** Quale opzione ho toccato: serve solo a evidenziarla. */
  miaRisposta: number | null
  /**
   * Se ho già risposto. È separato da `miaRisposta` perché chi rientra dopo una caduta
   * di linea sa di aver risposto ma non si ricorda cosa aveva toccato.
   */
  haRisposto: boolean
  rivelazione: Rivelazione | null
  finale: Finale | null
  errore: string | null
  sonoHost: boolean
  crea: (gameType: GameType, questionSetId: string) => Promise<void>
  entra: (pin: string) => Promise<void>
  cambiaTempo: (secondi: TempoDisponibile) => Promise<void>
  avvia: () => Promise<void>
  rispondi: (optionIndex: number) => Promise<void>
  prossima: () => Promise<void>
  esciDallaPartita: () => void
  pulisciErrore: () => void
}

const Contesto = createContext<ContestoPartita | null>(null)

function verifica(esito: Esito | EsitoCon<unknown>): void {
  if (!esito.ok) throw new Error(esito.message ?? 'Qualcosa è andato storto.')
}

/**
 * Il PIN della partita in corso vive anche fuori dalla memoria di React: se il
 * telefono ricarica la pagina (cosa che il browser fa da solo quando l'app resta in
 * secondo piano), lo stato React sparisce ma il giocatore è ancora in partita.
 * Ritrovando il PIN qui, l'app rientra da sola invece di mostrare l'hub.
 */
const CHIAVE_PIN = 'party-games.partita'

/**
 * Si salva anche di CHI è la partita: su un telefono passato di mano, chi accede
 * dopo non deve ritrovarsi catapultato nella partita del proprietario.
 */
const ricordaPin = (pin: string, userId: string) =>
  localStorage.setItem(CHIAVE_PIN, JSON.stringify({ pin, userId }))

const dimenticaPin = () => localStorage.removeItem(CHIAVE_PIN)

function pinRicordato(userId: string): string | null {
  const grezzo = localStorage.getItem(CHIAVE_PIN)
  if (!grezzo) return null
  try {
    const dati = JSON.parse(grezzo) as { pin?: unknown; userId?: unknown }
    if (typeof dati.pin !== 'string' || dati.userId !== userId) return null
    return dati.pin
  } catch {
    // Formato vecchio o corrotto: si butta invece di indovinare.
    dimenticaPin()
    return null
  }
}

export function ProviderPartita({ children }: { children: ReactNode }) {
  const { utente } = useAuth()
  const [collegato, setCollegato] = useState(false)
  const [stato, setStato] = useState<StatoPartita | null>(null)
  const [schermata, setSchermata] = useState<Schermata>('fuori')
  const [domanda, setDomanda] = useState<DomandaInCorso | null>(null)
  const [miaRisposta, setMiaRisposta] = useState<number | null>(null)
  const [haRisposto, setHaRisposto] = useState(false)
  const [rivelazione, setRivelazione] = useState<Rivelazione | null>(null)
  const [finale, setFinale] = useState<Finale | null>(null)
  const [errore, setErrore] = useState<string | null>(null)

  /** Svuota solo lo stato a schermo, senza dimenticare la partita in corso. */
  const svuotaStato = useCallback(() => {
    setStato(null)
    setSchermata('fuori')
    setDomanda(null)
    setMiaRisposta(null)
    setHaRisposto(false)
    setRivelazione(null)
    setFinale(null)
  }, [])

  /** Esce davvero: si dimentica anche quale partita si stava giocando. */
  const azzera = useCallback(() => {
    dimenticaPin()
    svuotaStato()
  }, [svuotaStato])

  useEffect(() => {
    if (!utente) {
      // Attenzione: qui NON si dimentica la partita. Al caricamento della pagina
      // questo ramo viene eseguito prima che l'accesso sia confermato, e cancellare
      // il PIN qui vorrebbe dire non poter piu' rientrare dopo un ricaricamento.
      scollegaSocket()
      setCollegato(false)
      svuotaStato()
      return
    }

    const socket = getSocket()

    const alCollegamento = () => {
      setCollegato(true)

      // Ogni collegamento è anche un possibile RIcollegamento: se risulta una partita
      // in corso si prova a rientrare. Vale sia dopo un buco di rete sia dopo un
      // ricaricamento della pagina, che per il server sono la stessa cosa.
      const pin = pinRicordato(utente.id)
      if (!pin) return
      socket.emit('game:rejoin', { pin }, (esito) => {
        // Partita finita o server ripartito: si torna all'hub in silenzio, senza
        // schermate rosse per una cosa di cui il giocatore non ha colpa.
        if (!esito.ok) azzera()
      })
    }

    const alloScollegamento = () => setCollegato(false)
    const allErrore = (e: Error) => setErrore(`Collegamento non riuscito: ${e.message}`)

    const aggiornaLobby = ({ stato: nuovo }: { stato: StatoPartita }) => {
      setStato(nuovo)
      // Gli aggiornamenti di lobby arrivano anche a partita in corso (qualcuno esce):
      // non devono riportare indietro chi sta rispondendo a una domanda.
      setSchermata((corrente) => (corrente === 'fuori' ? 'lobby' : corrente))
    }

    const inPartenza = () => {
      setFinale(null)
      setRivelazione(null)
      setSchermata('partenza')
    }

    const nuovaDomanda = (p: {
      index: number
      total: number
      question: QuestionPublic
      serverNow: number
      deadlineTs: number
      durationMs: number
    }) => {
      setDomanda({
        index: p.index,
        total: p.total,
        question: p.question,
        deadlineTs: p.deadlineTs,
        durationMs: p.durationMs,
        scartoMs: p.serverNow - Date.now(),
      })
      setMiaRisposta(null)
      setHaRisposto(false)
      setRivelazione(null)
      setSchermata('domanda')
    }

    const rispostaRegistrata = (p: { accepted: boolean }) => {
      // Se il server ha rifiutato (troppo tardi), il tasto non resta "premuto".
      if (p.accepted) setHaRisposto(true)
      else {
        setMiaRisposta(null)
        setHaRisposto(false)
      }
    }

    /** Fotografia della partita: rimette il telefono nella schermata giusta. */
    const rimettiInPari = (p: {
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
    }) => {
      setStato(p.stato)
      ricordaPin(p.stato.pin, utente.id)

      if (p.stato.fase === 'QUESTION' && p.domandaInCorso) {
        const d = p.domandaInCorso
        setDomanda({
          index: d.index,
          total: d.total,
          question: d.question,
          deadlineTs: d.deadlineTs,
          durationMs: d.durationMs,
          scartoMs: d.serverNow - Date.now(),
        })
        // Si sa che ha risposto, non cosa aveva toccato: nessun tassello evidenziato.
        setHaRisposto(d.haGiaRisposto)
        setMiaRisposta(null)
        setSchermata('domanda')
        return
      }

      if (p.stato.fase === 'PODIUM' || p.stato.fase === 'ENDED') {
        setFinale({ podium: p.scoreboard, totalQuestions: p.stato.totalQuestions })
        setSchermata('podio')
        return
      }

      if (p.stato.fase === 'REVEAL') {
        setSchermata('attesa')
        return
      }

      setSchermata('lobby')
    }

    const capoCaduto = ({ graceMs }: { graceMs: number }) =>
      setErrore(
        `Il capo partita si è scollegato. Se non torna entro ${Math.round(graceMs / 1000)} secondi passa il comando.`,
      )

    const risultato = (p: Rivelazione) => {
      setRivelazione(p)
      setSchermata('risultato')
    }

    const fine = (p: Finale) => {
      setFinale(p)
      setDomanda(null)
      setSchermata('podio')
    }

    const chiusa = ({ motivo }: { motivo: string }) => {
      azzera()
      setErrore(motivo)
    }

    const cambioHost = ({ nickname }: { nickname: string }) =>
      setErrore(`${nickname} è il nuovo capo partita.`)

    socket.on('connect', alCollegamento)
    socket.on('disconnect', alloScollegamento)
    socket.on('connect_error', allErrore)
    socket.on('lobby:update', aggiornaLobby)
    socket.on('game:starting', inPartenza)
    socket.on('question:show', nuovaDomanda)
    socket.on('answer:ack', rispostaRegistrata)
    socket.on('question:reveal', risultato)
    socket.on('game:over', fine)
    socket.on('game:state', rimettiInPari)
    socket.on('game:closed', chiusa)
    socket.on('host:changed', cambioHost)
    socket.on('host:disconnected', capoCaduto)
    socket.connect()

    return () => {
      socket.off('connect', alCollegamento)
      socket.off('disconnect', alloScollegamento)
      socket.off('connect_error', allErrore)
      socket.off('lobby:update', aggiornaLobby)
      socket.off('game:starting', inPartenza)
      socket.off('question:show', nuovaDomanda)
      socket.off('answer:ack', rispostaRegistrata)
      socket.off('question:reveal', risultato)
      socket.off('game:over', fine)
      socket.off('game:state', rimettiInPari)
      socket.off('game:closed', chiusa)
      socket.off('host:changed', cambioHost)
      socket.off('host:disconnected', capoCaduto)
    }
  }, [utente, azzera])

  // `idUtente` DEVE stare nelle dipendenze: senza, queste funzioni restano legate al
  // primo rendering, quando l'accesso non è ancora confermato, e memorizzerebbero la
  // partita a nome di nessuno — rendendo impossibile rientrare dopo un ricaricamento.
  const idUtente = utente?.id

  const entraInPartita = useCallback(
    (stato: StatoPartita) => {
      setStato(stato)
      if (idUtente) ricordaPin(stato.pin, idUtente)
      setSchermata('lobby')
    },
    [idUtente],
  )

  const crea = useCallback(
    async (gameType: GameType, questionSetId: string) => {
      const esito = await new Promise<EsitoCon<{ stato: StatoPartita }>>((risolvi) => {
        getSocket().emit('game:create', { gameType, questionSetId }, risolvi)
      })
      verifica(esito)
      if (esito.ok) entraInPartita(esito.stato)
    },
    [entraInPartita],
  )

  const entra = useCallback(
    async (pin: string) => {
      const esito = await new Promise<EsitoCon<{ stato: StatoPartita }>>((risolvi) => {
        getSocket().emit('game:join', { pin }, risolvi)
      })
      verifica(esito)
      if (esito.ok) entraInPartita(esito.stato)
    },
    [entraInPartita],
  )

  const cambiaTempo = useCallback(async (secondi: TempoDisponibile) => {
    const esito = await new Promise<Esito>((risolvi) => {
      getSocket().emit('lobby:settings', { timeLimitSec: secondi }, risolvi)
    })
    verifica(esito)
  }, [])

  const avvia = useCallback(async () => {
    const esito = await new Promise<Esito>((risolvi) => {
      getSocket().emit('game:start', risolvi)
    })
    verifica(esito)
  }, [])

  const rispondi = useCallback(
    async (optionIndex: number) => {
      if (!domanda || haRisposto) return
      // Si evidenzia subito la scelta senza aspettare il server: il tocco deve
      // sembrare istantaneo. Se poi il server rifiuta, answer:ack la toglie.
      setMiaRisposta(optionIndex)
      setHaRisposto(true)
      const esito = await new Promise<Esito>((risolvi) => {
        getSocket().emit(
          'answer:submit',
          { questionIndex: domanda.index, optionIndex },
          risolvi,
        )
      })
      if (!esito.ok) {
        setMiaRisposta(null)
        setHaRisposto(false)
      }
    },
    [domanda, haRisposto],
  )

  const prossima = useCallback(async () => {
    const esito = await new Promise<Esito>((risolvi) => {
      getSocket().emit('game:next', risolvi)
    })
    verifica(esito)
  }, [])

  const esciDallaPartita = useCallback(() => {
    getSocket().emit('game:leave')
    azzera()
  }, [azzera])

  const valore = useMemo<ContestoPartita>(
    () => ({
      collegato,
      stato,
      schermata,
      domanda,
      miaRisposta,
      haRisposto,
      rivelazione,
      finale,
      errore,
      sonoHost: Boolean(stato && utente && stato.hostId === utente.id),
      crea,
      entra,
      cambiaTempo,
      avvia,
      rispondi,
      prossima,
      esciDallaPartita,
      pulisciErrore: () => setErrore(null),
    }),
    [
      collegato,
      stato,
      schermata,
      domanda,
      miaRisposta,
      haRisposto,
      rivelazione,
      finale,
      errore,
      utente,
      crea,
      entra,
      cambiaTempo,
      avvia,
      rispondi,
      prossima,
      esciDallaPartita,
    ],
  )

  return <Contesto.Provider value={valore}>{children}</Contesto.Provider>
}

export function usePartita(): ContestoPartita {
  const contesto = useContext(Contesto)
  if (!contesto) throw new Error('usePartita va usato dentro <ProviderPartita>')
  return contesto
}
