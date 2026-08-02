// Hub: da qui si crea una partita o si entra con il codice di un amico.

import { useEffect, useState } from 'react'
import { GIOCHI } from '@party/shared'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { usePartita } from '../lib/partita'
import { HallOfFamePage } from './HallOfFamePage'

interface SetDomande {
  id: string
  title: string
  description: string | null
  numeroDomande: number
  autore: string
}

export function HomePage() {
  const { utente, esci } = useAuth()
  const { crea, entra, collegato } = usePartita()

  const [set, setSet] = useState<SetDomande[]>([])
  const [setScelto, setSetScelto] = useState('')
  const [pin, setPin] = useState('')
  const [messaggio, setMessaggio] = useState<string | null>(null)
  const [inCorso, setInCorso] = useState(false)
  const [mostraAlbo, setMostraAlbo] = useState(false)

  useEffect(() => {
    let annullato = false
    api
      .get<{ set: SetDomande[] }>('/question-sets')
      .then((dati) => {
        if (annullato) return
        setSet(dati.set)
        if (dati.set.length > 0) setSetScelto(dati.set[0].id)
      })
      .catch(() => {
        if (!annullato) setMessaggio('Non riesco a caricare i pacchetti di domande.')
      })
    return () => {
      annullato = true
    }
  }, [])

  const creaPartita = async (gameType: 'quiz') => {
    setMessaggio(null)
    setInCorso(true)
    try {
      await crea(gameType, setScelto)
    } catch (e) {
      setMessaggio(e instanceof Error ? e.message : 'Non riesco a creare la partita.')
    } finally {
      setInCorso(false)
    }
  }

  const entraConCodice = async (evento: React.FormEvent) => {
    evento.preventDefault()
    setMessaggio(null)
    setInCorso(true)
    try {
      await entra(pin.trim())
    } catch (e) {
      setMessaggio(e instanceof Error ? e.message : 'Non riesco a entrare.')
    } finally {
      setInCorso(false)
    }
  }

  const setPronto = setScelto !== ''

  // L'albo è una deviazione dall'hub, non una fase del gioco: resta una schermata
  // locale invece di entrare nello stato della partita.
  if (mostraAlbo) return <HallOfFamePage indietro={() => setMostraAlbo(false)} />

  return (
    <div className="pagina">
      <div className="barra-alta">
        <div className="logo">
          <span className="logo-punto" />
          Party Games
        </div>
        <button type="button" className="collegamento" onClick={esci}>
          Esci
        </button>
      </div>

      <div>
        <h1>Ciao {utente?.username}</h1>
        <p className="tenue">Crea una partita e detta il codice, oppure entra in una.</p>
      </div>

      <form className="scheda" onSubmit={entraConCodice}>
        <h2>Entra con un codice</h2>
        <label className="campo">
          <span>Codice della partita</span>
          <input
            className="mono campo-pin"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            /* numerico: sui telefoni apre il tastierino invece della tastiera intera */
            inputMode="numeric"
            autoComplete="off"
            placeholder="123456"
          />
        </label>
        <button type="submit" className="primario" disabled={pin.length !== 6 || inCorso}>
          Entra
        </button>
      </form>

      {GIOCHI.map((gioco) => (
        <div className="scheda" key={gioco.id}>
          <h2>{gioco.nome}</h2>
          <p className="tenue">{gioco.descrizione}</p>

          {set.length > 1 && (
            <label className="campo">
              <span>Pacchetto di domande</span>
              <select value={setScelto} onChange={(e) => setSetScelto(e.target.value)}>
                {set.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} ({s.numeroDomande} domande)
                  </option>
                ))}
              </select>
            </label>
          )}
          {set.length === 1 && (
            <p className="tenue nota">
              {set[0].title} · {set[0].numeroDomande} domande
            </p>
          )}

          <button
            type="button"
            className="primario"
            disabled={!gioco.disponibile || !setPronto || inCorso}
            onClick={() => creaPartita(gioco.id)}
          >
            Crea partita
          </button>
        </div>
      ))}

      <button type="button" onClick={() => setMostraAlbo(true)}>
        Albo d'oro
      </button>

      {messaggio && <p className="messaggio-errore">{messaggio}</p>}

      {!collegato && (
        <span className="stato">
          <span className="stato-pallino attesa" />
          Mi sto collegando...
        </span>
      )}
    </div>
  )
}
