// Radice dell'app: decide cosa mostrare in base allo stato di accesso e di partita.
// Dentro la partita non si usano gli URL: la schermata è una conseguenza degli eventi
// del server, non di una navigazione fatta dal telefono.

import { ProviderAuth, useAuth } from './lib/auth'
import { ProviderPartita, usePartita } from './lib/partita'
import { HomePage } from './pages/HomePage'
import { LobbyPage } from './pages/LobbyPage'
import { LoginPage } from './pages/LoginPage'
import { PlayPage } from './pages/PlayPage'
import { PodiumPage } from './pages/PodiumPage'
import { RevealPage } from './pages/RevealPage'

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
  const { schermata } = usePartita()

  if (caricamento) return <Attesa testo="Un attimo..." />
  if (!utente) return <LoginPage />

  switch (schermata) {
    case 'lobby':
      return <LobbyPage />
    case 'partenza':
      return <Attesa testo="Si comincia!" sottotitolo="Preparati..." />
    case 'domanda':
      return <PlayPage />
    case 'risultato':
      return <RevealPage />
    case 'podio':
      return <PodiumPage />
    case 'attesa':
      // Rientrati tra una domanda e l'altra: la prossima arriva entro pochi secondi.
      return <Attesa testo="Sei di nuovo dentro" sottotitolo="Aspetta la prossima domanda..." />
    default:
      return <HomePage />
  }
}

function Attesa({ testo, sottotitolo }: { testo: string; sottotitolo?: string }) {
  return (
    <div className="pagina centrata">
      <span className="stato">
        <span className="stato-pallino attesa" />
        {testo}
      </span>
      {sottotitolo && <p className="tenue">{sottotitolo}</p>}
    </div>
  )
}
