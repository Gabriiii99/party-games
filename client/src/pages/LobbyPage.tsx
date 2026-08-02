// Sala d'attesa: il codice da dettare agli amici e chi è già arrivato.
// L'elenco si aggiorna da solo: ogni ingresso o uscita arriva dal server via WebSocket.

import { useState } from 'react'
import { TEMPI_DISPONIBILI, type TempoDisponibile } from '@party/shared'
import { useAuth } from '../lib/auth'
import { usePartita } from '../lib/partita'

export function LobbyPage() {
  const { utente } = useAuth()
  const { stato, sonoHost, collegato, cambiaTempo, avvia, esciDallaPartita } = usePartita()
  const [messaggio, setMessaggio] = useState<string | null>(null)
  const [copiato, setCopiato] = useState(false)

  if (!stato) return null

  const copiaCodice = async () => {
    try {
      await navigator.clipboard.writeText(stato.pin)
      setCopiato(true)
      setTimeout(() => setCopiato(false), 2000)
    } catch {
      // Su alcuni browser gli appunti sono negati: il codice resta comunque leggibile.
      setMessaggio('Non riesco a copiare: detta il codice a voce.')
    }
  }

  const scegliTempo = async (secondi: TempoDisponibile) => {
    setMessaggio(null)
    try {
      await cambiaTempo(secondi)
    } catch (e) {
      setMessaggio(e instanceof Error ? e.message : 'Non riesco a cambiare il tempo.')
    }
  }

  const premiAvvia = async () => {
    setMessaggio(null)
    try {
      await avvia()
    } catch (e) {
      setMessaggio(e instanceof Error ? e.message : 'Non riesco ad avviare.')
    }
  }

  return (
    <div className="pagina">
      <div className="barra-alta">
        <div className="logo">
          <span className="logo-punto" />
          Party Games
        </div>
        <button type="button" className="collegamento" onClick={esciDallaPartita}>
          Esci dalla partita
        </button>
      </div>

      <div className="scheda codice-partita">
        <p className="tenue nota">Codice della partita</p>
        <p className="pin mono">{stato.pin}</p>
        <button type="button" onClick={copiaCodice}>
          {copiato ? 'Copiato!' : 'Copia il codice'}
        </button>
        <p className="tenue nota">
          {stato.titoloSet} · {stato.totalQuestions} domande
        </p>
      </div>

      <div className="scheda">
        <h2>
          Giocatori ({stato.players.length})
        </h2>
        <ul className="elenco-giocatori">
          {stato.players.map((g) => (
            <li key={g.userId} className={g.connected ? undefined : 'assente'}>
              <span className="nome-giocatore">
                {g.nickname}
                {g.userId === utente?.id && <span className="tenue"> (tu)</span>}
              </span>
              {g.isHost && <span className="etichetta">capo partita</span>}
              {!g.connected && <span className="etichetta tenue">assente</span>}
            </li>
          ))}
        </ul>
        {stato.players.length < 2 && (
          <p className="tenue nota">
            In attesa di altri giocatori: passa il codice a chi deve entrare.
          </p>
        )}
      </div>

      {sonoHost ? (
        <div className="scheda">
          <h2>Secondi per domanda</h2>
          <div className="scelta-tempo">
            {TEMPI_DISPONIBILI.map((secondi) => (
              <button
                key={secondi}
                type="button"
                className={secondi === stato.timeLimitSec ? 'primario' : undefined}
                onClick={() => scegliTempo(secondi)}
              >
                {secondi}s
              </button>
            ))}
          </div>
          <button type="button" className="primario" onClick={premiAvvia}>
            Avvia la partita
          </button>
        </div>
      ) : (
        <div className="scheda">
          <p className="tenue">
            {stato.timeLimitSec} secondi per domanda. Si parte quando il capo partita dà
            il via.
          </p>
        </div>
      )}

      {messaggio && <p className="messaggio-errore">{messaggio}</p>}

      {!collegato && (
        <span className="stato">
          <span className="stato-pallino errore" />
          Collegamento perso, sto riprovando...
        </span>
      )}
    </div>
  )
}
