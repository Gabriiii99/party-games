// Stato di autenticazione condiviso da tutta l'app.
// Il token vive in localStorage, cosi' chi ha fatto login resta dentro anche dopo
// aver chiuso l'app (i token durano 30 giorni).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Utente } from '@party/shared'
import { api, cancellaToken, leggiToken, salvaToken } from './api'

interface RispostaAuth {
  token: string
  utente: Utente
}

interface ContestoAuth {
  utente: Utente | null
  /** true finche' non si sa se il token salvato e' valido. */
  caricamento: boolean
  accedi: (username: string, password: string) => Promise<void>
  registrati: (username: string, password: string) => Promise<void>
  esci: () => void
}

const Contesto = createContext<ContestoAuth | null>(null)

export function ProviderAuth({ children }: { children: ReactNode }) {
  const [utente, setUtente] = useState<Utente | null>(null)
  const [caricamento, setCaricamento] = useState(true)

  // All'avvio: se c'e' un token salvato si controlla che sia ancora valido.
  useEffect(() => {
    if (!leggiToken()) {
      setCaricamento(false)
      return
    }
    let annullato = false
    api
      .get<{ utente: Utente }>('/auth/me')
      .then((dati) => {
        if (!annullato) setUtente(dati.utente)
      })
      .catch(() => {
        // Token scaduto, non valido, oppure database non ancora configurato.
        cancellaToken()
      })
      .finally(() => {
        if (!annullato) setCaricamento(false)
      })
    return () => {
      annullato = true
    }
  }, [])

  const entra = useCallback(async (percorso: string, username: string, password: string) => {
    const dati = await api.post<RispostaAuth>(percorso, { username, password })
    salvaToken(dati.token)
    setUtente(dati.utente)
  }, [])

  const valore = useMemo<ContestoAuth>(
    () => ({
      utente,
      caricamento,
      accedi: (username, password) => entra('/auth/login', username, password),
      registrati: (username, password) => entra('/auth/register', username, password),
      esci: () => {
        cancellaToken()
        setUtente(null)
      },
    }),
    [utente, caricamento, entra],
  )

  return <Contesto.Provider value={valore}>{children}</Contesto.Provider>
}

export function useAuth(): ContestoAuth {
  const contesto = useContext(Contesto)
  if (!contesto) throw new Error('useAuth va usato dentro <ProviderAuth>')
  return contesto
}
