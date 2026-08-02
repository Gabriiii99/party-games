// Hub: da qui si crea una partita, si entra con un codice, si guarda l'albo d'oro e
// si scrivono le domande.
//
// Albo ed editor non sono fasi di gioco: sono deviazioni dall'hub, quindi vivono in
// uno stato locale invece di finire nello stato della partita, che è del server.

import { useCallback, useEffect, useState } from 'react'
import { GIOCHI } from '@party/shared'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { usePartita } from '../lib/partita'
import { EditorPacchettoPage } from './EditorPacchettoPage'
import { HallOfFamePage } from './HallOfFamePage'
import { PacchettiPage, type SetDomande } from './PacchettiPage'

type Vista =
  | { tipo: 'hub' }
  | { tipo: 'albo' }
  | { tipo: 'pacchetti' }
  | { tipo: 'editor'; id: string | null }

export function HomePage() {
  const { utente, esci } = useAuth()
  const { crea, entra, collegato } = usePartita()

  const [vista, setVista] = useState<Vista>({ tipo: 'hub' })
  const [set, setSet] = useState<SetDomande[]>([])
  const [setScelto, setSetScelto] = useState('')
  const [pin, setPin] = useState('')
  const [messaggio, setMessaggio] = useState<string | null>(null)
  const [inCorso, setInCorso] = useState(false)

  const caricaSet = useCallback(() => {
    api
      .get<{ set: SetDomande[] }>('/question-sets')
      .then((dati) => {
        setSet(dati.set)
        // Se il pacchetto scelto è sparito (cancellato), si ricade sul primo.
        setSetScelto((attuale) =>
          dati.set.some((s) => s.id === attuale) ? attuale : (dati.set[0]?.id ?? ''),
        )
      })
      .catch(() => setMessaggio('Non riesco a caricare i pacchetti di domande.'))
  }, [])

  useEffect(caricaSet, [caricaSet])

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

  if (vista.tipo === 'albo') {
    return <HallOfFamePage indietro={() => setVista({ tipo: 'hub' })} />
  }

  if (vista.tipo === 'pacchetti') {
    return (
      <PacchettiPage
        indietro={() => {
          caricaSet() // può aver cancellato qualcosa
          setVista({ tipo: 'hub' })
        }}
        apriEditor={(id) => setVista({ tipo: 'editor', id })}
      />
    )
  }

  if (vista.tipo === 'editor') {
    return (
      <EditorPacchettoPage
        id={vista.id}
        chiudi={(salvato) => {
          if (salvato) caricaSet()
          setVista({ tipo: 'pacchetti' })
        }}
      />
    )
  }

  const setPronto = setScelto !== ''
  const sceltoOra = set.find((s) => s.id === setScelto)

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

          {set.length > 1 ? (
            <label className="campo">
              <span>Pacchetto di domande</span>
              <select value={setScelto} onChange={(e) => setSetScelto(e.target.value)}>
                {set.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} ({s.numeroDomande})
                  </option>
                ))}
              </select>
            </label>
          ) : (
            sceltoOra && (
              <p className="tenue nota">
                {sceltoOra.title} · {sceltoOra.numeroDomande} domande
              </p>
            )
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

      <div className="riga-azioni">
        <button type="button" onClick={() => setVista({ tipo: 'pacchetti' })}>
          Le domande
        </button>
        <button type="button" onClick={() => setVista({ tipo: 'albo' })}>
          Albo d'oro
        </button>
      </div>

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
