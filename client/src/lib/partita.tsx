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
export type Schermata = 'fuori' | 'lobby' | 'partenza' | 'domanda' | 'risultato' | 'podio'

interface ContestoPartita {
  collegato: boolean
  stato: StatoPartita | null
  schermata: Schermata
  domanda: DomandaInCorso | null
  miaRisposta: number | null
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

export function ProviderPartita({ children }: { children: ReactNode }) {
  const { utente } = useAuth()
  const [collegato, setCollegato] = useState(false)
  const [stato, setStato] = useState<StatoPartita | null>(null)
  const [schermata, setSchermata] = useState<Schermata>('fuori')
  const [domanda, setDomanda] = useState<DomandaInCorso | null>(null)
  const [miaRisposta, setMiaRisposta] = useState<number | null>(null)
  const [rivelazione, setRivelazione] = useState<Rivelazione | null>(null)
  const [finale, setFinale] = useState<Finale | null>(null)
  const [errore, setErrore] = useState<string | null>(null)

  const azzera = useCallback(() => {
    setStato(null)
    setSchermata('fuori')
    setDomanda(null)
    setMiaRisposta(null)
    setRivelazione(null)
    setFinale(null)
  }, [])

  useEffect(() => {
    if (!utente) {
      scollegaSocket()
      setCollegato(false)
      azzera()
      return
    }

    const socket = getSocket()

    const alCollegamento = () => setCollegato(true)
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
      setRivelazione(null)
      setSchermata('domanda')
    }

    const rispostaRegistrata = (p: { accepted: boolean }) => {
      // Se il server ha rifiutato (troppo tardi), il tasso non resta "premuto".
      if (!p.accepted) setMiaRisposta(null)
    }

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
    socket.on('game:closed', chiusa)
    socket.on('host:changed', cambioHost)
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
      socket.off('game:closed', chiusa)
      socket.off('host:changed', cambioHost)
    }
  }, [utente, azzera])

  const crea = useCallback(
    async (gameType: GameType, questionSetId: string) => {
      const esito = await new Promise<EsitoCon<{ stato: StatoPartita }>>((risolvi) => {
        getSocket().emit('game:create', { gameType, questionSetId }, risolvi)
      })
      verifica(esito)
      if (esito.ok) {
        setStato(esito.stato)
        setSchermata('lobby')
      }
    },
    [],
  )

  const entra = useCallback(async (pin: string) => {
    const esito = await new Promise<EsitoCon<{ stato: StatoPartita }>>((risolvi) => {
      getSocket().emit('game:join', { pin }, risolvi)
    })
    verifica(esito)
    if (esito.ok) {
      setStato(esito.stato)
      setSchermata('lobby')
    }
  }, [])

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
      if (!domanda || miaRisposta !== null) return
      // Si evidenzia subito la scelta senza aspettare il server: il tocco deve
      // sembrare istantaneo. Se poi il server rifiuta, answer:ack la toglie.
      setMiaRisposta(optionIndex)
      const esito = await new Promise<Esito>((risolvi) => {
        getSocket().emit(
          'answer:submit',
          { questionIndex: domanda.index, optionIndex },
          risolvi,
        )
      })
      if (!esito.ok) setMiaRisposta(null)
    },
    [domanda, miaRisposta],
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
