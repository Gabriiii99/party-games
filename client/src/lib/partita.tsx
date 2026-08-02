// Stato della partita, condiviso da tutte le schermate.
//
// Il client non tiene una propria idea di come vanno le cose: riceve dal server lo
// stato completo e lo mostra. Ogni richiesta (crea, entra, cambia tempo) aspetta la
// risposta del server prima di dire all'utente che è andata bene.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Esito, EsitoCon, GameType, StatoPartita, TempoDisponibile } from '@party/shared'
import { useAuth } from './auth'
import { getSocket, scollegaSocket } from './socket'

interface ContestoPartita {
  /** true quando il WebSocket è agganciato al server. */
  collegato: boolean
  stato: StatoPartita | null
  errore: string | null
  sonoHost: boolean
  crea: (gameType: GameType, questionSetId: string) => Promise<void>
  entra: (pin: string) => Promise<void>
  cambiaTempo: (secondi: TempoDisponibile) => Promise<void>
  avvia: () => Promise<void>
  esciDallaPartita: () => void
  pulisciErrore: () => void
}

const Contesto = createContext<ContestoPartita | null>(null)

/** Trasforma un errore del server in un'eccezione con il suo messaggio. */
function verifica(esito: Esito | EsitoCon<unknown>): void {
  if (!esito.ok) {
    throw new Error(esito.message ?? 'Qualcosa è andato storto.')
  }
}

export function ProviderPartita({ children }: { children: ReactNode }) {
  const { utente } = useAuth()
  const [collegato, setCollegato] = useState(false)
  const [stato, setStato] = useState<StatoPartita | null>(null)
  const [errore, setErrore] = useState<string | null>(null)

  useEffect(() => {
    // Senza accesso non c'è token da presentare: inutile provare a collegarsi.
    if (!utente) {
      scollegaSocket()
      setCollegato(false)
      setStato(null)
      return
    }

    const socket = getSocket()

    const alCollegamento = () => setCollegato(true)
    const alloScollegamento = () => setCollegato(false)
    const allErrore = (e: Error) => setErrore(`Collegamento non riuscito: ${e.message}`)
    const aggiorna = ({ stato: nuovo }: { stato: StatoPartita }) => setStato(nuovo)
    const chiusa = ({ motivo }: { motivo: string }) => {
      setStato(null)
      setErrore(motivo)
    }
    const cambioHost = ({ nickname }: { nickname: string }) =>
      setErrore(`${nickname} è il nuovo capo partita.`)

    socket.on('connect', alCollegamento)
    socket.on('disconnect', alloScollegamento)
    socket.on('connect_error', allErrore)
    socket.on('lobby:update', aggiorna)
    socket.on('game:closed', chiusa)
    socket.on('host:changed', cambioHost)
    socket.connect()

    return () => {
      socket.off('connect', alCollegamento)
      socket.off('disconnect', alloScollegamento)
      socket.off('connect_error', allErrore)
      socket.off('lobby:update', aggiorna)
      socket.off('game:closed', chiusa)
      socket.off('host:changed', cambioHost)
    }
  }, [utente])

  const crea = useCallback(async (gameType: GameType, questionSetId: string) => {
    const socket = getSocket()
    const esito = await new Promise<EsitoCon<{ stato: StatoPartita }>>((risolvi) => {
      socket.emit('game:create', { gameType, questionSetId }, risolvi)
    })
    verifica(esito)
    if (esito.ok) setStato(esito.stato)
  }, [])

  const entra = useCallback(async (pin: string) => {
    const socket = getSocket()
    const esito = await new Promise<EsitoCon<{ stato: StatoPartita }>>((risolvi) => {
      socket.emit('game:join', { pin }, risolvi)
    })
    verifica(esito)
    if (esito.ok) setStato(esito.stato)
  }, [])

  const cambiaTempo = useCallback(async (secondi: TempoDisponibile) => {
    const socket = getSocket()
    const esito = await new Promise<Esito>((risolvi) => {
      socket.emit('lobby:settings', { timeLimitSec: secondi }, risolvi)
    })
    verifica(esito)
  }, [])

  const avvia = useCallback(async () => {
    const socket = getSocket()
    const esito = await new Promise<Esito>((risolvi) => {
      socket.emit('game:start', risolvi)
    })
    verifica(esito)
  }, [])

  const esciDallaPartita = useCallback(() => {
    getSocket().emit('game:leave')
    setStato(null)
  }, [])

  const valore = useMemo<ContestoPartita>(
    () => ({
      collegato,
      stato,
      errore,
      sonoHost: Boolean(stato && utente && stato.hostId === utente.id),
      crea,
      entra,
      cambiaTempo,
      avvia,
      esciDallaPartita,
      pulisciErrore: () => setErrore(null),
    }),
    [collegato, stato, errore, utente, crea, entra, cambiaTempo, avvia, esciDallaPartita],
  )

  return <Contesto.Provider value={valore}>{children}</Contesto.Provider>
}

export function usePartita(): ContestoPartita {
  const contesto = useContext(Contesto)
  if (!contesto) throw new Error('usePartita va usato dentro <ProviderPartita>')
  return contesto
}
