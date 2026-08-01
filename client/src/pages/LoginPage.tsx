// Accesso e registrazione nella stessa schermata, ma con due azioni distinte:
// cosi' nessuno crea un account per sbaglio digitando male il proprio nome (o
// usando quello di un amico).

import { useState } from 'react'
import { useAuth } from '../lib/auth'

export function LoginPage() {
  const { accedi, registrati } = useAuth()
  const [modo, setModo] = useState<'accedi' | 'registrati'>('accedi')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [errore, setErrore] = useState<string | null>(null)
  const [inCorso, setInCorso] = useState(false)

  const nuovoAccount = modo === 'registrati'

  async function invia(evento: React.FormEvent) {
    evento.preventDefault()
    setErrore(null)
    setInCorso(true)
    try {
      if (nuovoAccount) {
        await registrati(username, password)
      } else {
        await accedi(username, password)
      }
    } catch (e: unknown) {
      setErrore(e instanceof Error ? e.message : 'Qualcosa è andato storto.')
    } finally {
      setInCorso(false)
    }
  }

  return (
    <div className="pagina">
      <div className="logo">
        <span className="logo-punto" />
        Party Games
      </div>

      <div>
        <h1>{nuovoAccount ? 'Crea il tuo account' : 'Bentornato'}</h1>
        <p className="tenue">
          {nuovoAccount
            ? 'Scegli un nome: è quello che vedranno gli altri in classifica.'
            : 'Entra col nome e la password che hai scelto.'}
        </p>
      </div>

      <form className="scheda" onSubmit={invia}>
        <label className="campo">
          <span>Nome</span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            maxLength={24}
            required
            placeholder="es. Gabriele"
          />
        </label>

        <label className="campo">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={nuovoAccount ? 'new-password' : 'current-password'}
            required
            placeholder="quello che vuoi"
          />
        </label>

        {errore && <p className="messaggio-errore">{errore}</p>}

        <button type="submit" className="primario" disabled={inCorso}>
          {inCorso ? 'Attendi...' : nuovoAccount ? 'Crea account' : 'Accedi'}
        </button>
      </form>

      <p className="tenue" style={{ textAlign: 'center' }}>
        {nuovoAccount ? 'Hai già un account?' : 'Prima volta qui?'}{' '}
        <button
          type="button"
          className="collegamento"
          onClick={() => {
            setModo(nuovoAccount ? 'accedi' : 'registrati')
            setErrore(null)
          }}
        >
          {nuovoAccount ? 'Accedi' : 'Crea un account'}
        </button>
      </p>

      <p className="tenue nota" style={{ marginTop: 'auto' }}>
        Nessuna email, nessun vincolo sulla password. Attenzione: proprio per questo non
        c'è il recupero password.
      </p>
    </div>
  )
}
