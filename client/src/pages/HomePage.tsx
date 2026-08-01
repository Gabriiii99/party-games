// Hub: elenco dei giochi disponibili.
// Da qui si creera' una partita o si entrera' con un PIN (Fase 2).

import { GIOCHI } from '@party/shared'
import { useAuth } from '../lib/auth'

export function HomePage() {
  const { utente, esci } = useAuth()

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
        <p className="tenue">Scegli un gioco, poi passa il codice agli altri.</p>
      </div>

      {GIOCHI.map((gioco) => (
        <div className="scheda" key={gioco.id}>
          <h2>{gioco.nome}</h2>
          <p className="tenue">{gioco.descrizione}</p>
          <button type="button" className="primario" disabled>
            Crea partita
          </button>
          <button type="button" disabled>
            Entra con un codice
          </button>
          <p className="tenue nota">Disponibile nella prossima fase.</p>
        </div>
      ))}

      <p className="tenue nota" style={{ marginTop: 'auto' }}>
        Fase 1 — accesso completato. Prossimo passo: lobby e ingresso con PIN.
      </p>
    </div>
  )
}
