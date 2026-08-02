// I pacchetti di domande: quelli tuoi si modificano, gli altri si possono solo giocare.

import { useEffect, useState } from 'react'
import { api } from '../lib/api'

export interface SetDomande {
  id: string
  title: string
  description: string | null
  numeroDomande: number
  autore: string
  mio: boolean
}

export function PacchettiPage({
  indietro,
  apriEditor,
}: {
  indietro: () => void
  apriEditor: (id: string | null) => void
}) {
  const [set, setSet] = useState<SetDomande[]>([])
  const [caricamento, setCaricamento] = useState(true)
  const [messaggio, setMessaggio] = useState<string | null>(null)
  const [inCancellazione, setInCancellazione] = useState<string | null>(null)

  const carica = () => {
    setCaricamento(true)
    api
      .get<{ set: SetDomande[] }>('/question-sets')
      .then((dati) => setSet(dati.set))
      .catch((e) => setMessaggio(e instanceof Error ? e.message : 'Non riesco a leggere i pacchetti.'))
      .finally(() => setCaricamento(false))
  }

  useEffect(carica, [])

  const cancella = async (pacchetto: SetDomande) => {
    // Cancellare un pacchetto non si annulla: meglio una domanda in più.
    if (!confirm(`Cancellare "${pacchetto.title}" e le sue ${pacchetto.numeroDomande} domande?`)) {
      return
    }
    setInCancellazione(pacchetto.id)
    setMessaggio(null)
    try {
      await api.del(`/question-sets/${pacchetto.id}`)
      setSet((attuali) => attuali.filter((s) => s.id !== pacchetto.id))
    } catch (e) {
      setMessaggio(e instanceof Error ? e.message : 'Non riesco a cancellare.')
    } finally {
      setInCancellazione(null)
    }
  }

  return (
    <div className="pagina">
      <div className="barra-alta">
        <div className="logo">
          <span className="logo-punto" />
          Le domande
        </div>
        <button type="button" className="collegamento" onClick={indietro}>
          Indietro
        </button>
      </div>

      <button type="button" className="primario" onClick={() => apriEditor(null)}>
        Nuovo pacchetto
      </button>

      {caricamento && (
        <span className="stato">
          <span className="stato-pallino attesa" />
          Un attimo...
        </span>
      )}

      {messaggio && <p className="messaggio-errore">{messaggio}</p>}

      {set.map((pacchetto) => (
        <div className="scheda" key={pacchetto.id}>
          <h2>{pacchetto.title}</h2>
          <p className="tenue nota">
            {pacchetto.numeroDomande} domande · di {pacchetto.autore}
          </p>
          {pacchetto.description && <p className="tenue">{pacchetto.description}</p>}

          {pacchetto.mio ? (
            <div className="riga-azioni">
              <button type="button" onClick={() => apriEditor(pacchetto.id)}>
                Modifica
              </button>
              <button
                type="button"
                className="pericolo"
                disabled={inCancellazione === pacchetto.id}
                onClick={() => cancella(pacchetto)}
              >
                Cancella
              </button>
            </div>
          ) : (
            <p className="tenue nota">
              Non è tuo: puoi giocarci, ma per cambiarlo devi farne uno nuovo.
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
