// Albo d'oro: chi vince di più e com'erano finite le ultime partite.

import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'

interface RigaGiocatore {
  userId: string
  username: string
  partite: number
  vittorie: number
  corrette: number
  domande: number
}

interface RigaPartita {
  id: string
  quando: string
  titoloSet: string | null
  numeroGiocatori: number
  vincitori: string[]
  punteggioVincente: number
}

/** "2 agosto" — l'anno si aggiunge solo quando non è quello in corso. */
function formattaData(iso: string): string {
  const data = new Date(iso)
  const opzioni: Intl.DateTimeFormatOptions =
    data.getFullYear() === new Date().getFullYear()
      ? { day: 'numeric', month: 'long' }
      : { day: 'numeric', month: 'long', year: 'numeric' }
  return data.toLocaleDateString('it-IT', opzioni)
}

export function HallOfFamePage({ indietro }: { indietro: () => void }) {
  const { utente } = useAuth()
  const [giocatori, setGiocatori] = useState<RigaGiocatore[]>([])
  const [partite, setPartite] = useState<RigaPartita[]>([])
  const [caricamento, setCaricamento] = useState(true)
  const [errore, setErrore] = useState<string | null>(null)

  useEffect(() => {
    let annullato = false
    api
      .get<{ giocatori: RigaGiocatore[]; partite: RigaPartita[] }>('/hall-of-fame')
      .then((dati) => {
        if (annullato) return
        setGiocatori(dati.giocatori)
        setPartite(dati.partite)
      })
      .catch((e) => {
        if (!annullato) setErrore(e instanceof Error ? e.message : 'Non riesco a leggere l’albo.')
      })
      .finally(() => {
        if (!annullato) setCaricamento(false)
      })
    return () => {
      annullato = true
    }
  }, [])

  return (
    <div className="pagina">
      <div className="barra-alta">
        <div className="logo">
          <span className="logo-punto" />
          Albo d'oro
        </div>
        <button type="button" className="collegamento" onClick={indietro}>
          Indietro
        </button>
      </div>

      {caricamento && (
        <span className="stato">
          <span className="stato-pallino attesa" />
          Sto sfogliando...
        </span>
      )}

      {errore && <p className="messaggio-errore">{errore}</p>}

      {!caricamento && !errore && giocatori.length === 0 && (
        <div className="scheda">
          <h2>Ancora niente</h2>
          <p className="tenue">
            Qui compariranno le vittorie appena finirete la prima partita.
          </p>
        </div>
      )}

      {giocatori.length > 0 && (
        <div className="scheda">
          <h2>Chi vince di più</h2>
          <ul className="elenco-giocatori">
            {giocatori.map((g, posizione) => (
              <li key={g.userId}>
                <span className="posizione">{posizione + 1}</span>
                <span className="nome-giocatore">
                  {g.username}
                  {g.userId === utente?.id && <span className="tenue"> (tu)</span>}
                  <span className="tenue nota">
                    {' '}
                    · {g.partite} {g.partite === 1 ? 'partita' : 'partite'} · {g.corrette}/
                    {g.domande} risposte
                  </span>
                </span>
                <span className="punteggio">
                  {g.vittorie} {g.vittorie === 1 ? 'vittoria' : 'vittorie'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {partite.length > 0 && (
        <div className="scheda">
          <h2>Ultime partite</h2>
          <ul className="elenco-partite">
            {partite.map((p) => (
              <li key={p.id}>
                <span className="nome-giocatore">
                  {p.vincitori.length > 1
                    ? `Pari merito: ${p.vincitori.join(', ')}`
                    : `Ha vinto ${p.vincitori[0] ?? '—'}`}
                  <span className="tenue nota">
                    {' '}
                    · {formattaData(p.quando)} · {p.numeroGiocatori} giocatori
                    {p.titoloSet ? ` · ${p.titoloSet}` : ''}
                  </span>
                </span>
                <span className="punteggio">{p.punteggioVincente}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
