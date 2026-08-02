// Radice dell'app: decide cosa mostrare in base allo stato di accesso e di partita.
// La navigazione dentro la partita non usa gli URL: le schermate (lobby, domanda,
// risultato, podio) le decide il server, quindi seguono lo stato del gioco.

import { ProviderAuth, useAuth } from './lib/auth'
import { ProviderPartita, usePartita } from './lib/partita'
import { HomePage } from './pages/HomePage'
import { LobbyPage } from './pages/LobbyPage'
import { LoginPage } from './pages/LoginPage'

export function App() {
  return (
    <ProviderAuth>
      <ProviderPartita>
        <Contenuto />
      </ProviderPartita>
    </ProviderAuth>
  )
}

function Contenuto() {
  const { utente, caricamento } = useAuth()
  const { stato } = usePartita()

  if (caricamento) {
    return (
      <div className="pagina centrata">
        <span className="stato">
          <span className="stato-pallino attesa" />
          Un attimo...
        </span>
      </div>
    )
  }

  if (!utente) return <LoginPage />
  if (stato) return <LobbyPage />
  return <HomePage />
}
