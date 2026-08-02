// Dopo ogni domanda: cos'era giusto, come è andata a te, come sta la classifica.

import { usePartita } from '../lib/partita'
import { useAuth } from '../lib/auth'

export function RevealPage() {
  const { utente } = useAuth()
  const { rivelazione, domanda, sonoHost, prossima } = usePartita()

  if (!rivelazione) return null

  const { correctIndex, yourAnswer, yourCorrect, counts, scoreboard, ultimaDomanda } =
    rivelazione
  const opzioni = domanda?.question.options ?? []

  const titolo = yourCorrect
    ? 'Giusto!'
    : yourAnswer === null
      ? 'Tempo scaduto'
      : 'Sbagliato'

  return (
    <div className="pagina">
      <div className={`esito ${yourCorrect ? 'giusto' : 'sbagliato'}`}>
        <h1>{titolo}</h1>
        <p className="tenue">
          {yourCorrect
            ? 'Un punto in più.'
            : `La risposta era: ${opzioni[correctIndex] ?? '—'}`}
        </p>
      </div>

      {opzioni.length > 0 && (
        <div className="scheda">
          <h2>Come hanno risposto</h2>
          <ul className="elenco-opzioni">
            {opzioni.map((opzione, indice) => (
              <li
                key={indice}
                className={indice === correctIndex ? 'corretta' : undefined}
              >
                <span className={`pallino colore-${indice + 1}`} />
                <span className="nome-giocatore">{opzione}</span>
                {indice === yourAnswer && <span className="etichetta">tu</span>}
                <span className="tenue">{counts[indice] ?? 0}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="scheda">
        <h2>Classifica</h2>
        <ul className="elenco-giocatori">
          {scoreboard.map((riga) => (
            <li key={riga.userId}>
              <span className="posizione">{riga.rank}</span>
              <span className="nome-giocatore">
                {riga.nickname}
                {riga.userId === utente?.id && <span className="tenue"> (tu)</span>}
              </span>
              <span className="punteggio">{riga.correctCount}</span>
            </li>
          ))}
        </ul>
      </div>

      {sonoHost ? (
        <button type="button" className="primario" onClick={() => prossima()}>
          {ultimaDomanda ? 'Vai al podio' : 'Prossima domanda'}
        </button>
      ) : (
        <p className="tenue nota">
          {ultimaDomanda ? 'Tra poco il podio...' : 'Tra poco la prossima domanda...'}
        </p>
      )}
    </div>
  )
}
