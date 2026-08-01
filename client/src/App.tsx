// Radice dell'app: decide cosa mostrare in base allo stato di accesso.
// La navigazione dentro la partita non usa gli URL: le schermate (lobby, domanda,
// risultato, podio) le decide il server, quindi seguono lo stato del gioco.

import { ProviderAuth, useAuth } from './lib/auth'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'

export function App() {
  return (
    <ProviderAuth>
      <Contenuto />
    </ProviderAuth>
  )
}

function Contenuto() {
  const { utente, caricamento } = useAuth()

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

  return utente ? <HomePage /> : <LoginPage />
}
