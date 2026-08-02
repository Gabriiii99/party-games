// Fine partita: il podio, con il tempo mostrato solo dove ha deciso qualcosa.

import { formattaTempo } from '@party/shared'
import { useAuth } from '../lib/auth'
import { usePartita } from '../lib/partita'

const MEDAGLIE = ['🥇', '🥈', '🥉']

export function PodiumPage() {
  const { utente } = useAuth()
  const { finale, esciDallaPartita } = usePartita()

  if (!finale) return null

  const { podium, totalQuestions } = finale
  const vincitori = podium.filter((r) => r.rank === 1)

  return (
    <div className="pagina">
      <div>
        <h1>{vincitori.length > 1 ? 'Pari merito!' : 'Vince ' + (vincitori[0]?.nickname ?? '')}</h1>
        <p className="tenue">Su {totalQuestions} domande.</p>
      </div>

      <ul className="podio">
        {podium.map((riga) => {
          // Il tempo è solo lo spareggio: si mostra dove c'è davvero qualcuno con lo
          // stesso numero di risposte giuste, altrimenti è un numero senza significato.
          const inParita = podium.some(
            (altro) =>
              altro.userId !== riga.userId && altro.correctCount === riga.correctCount,
          )
          return (
            <li key={riga.userId} className={riga.rank <= 3 ? `posto-${riga.rank}` : undefined}>
              <span className="medaglia">{MEDAGLIE[riga.rank - 1] ?? riga.rank}</span>
              <span className="nome-giocatore">
                {riga.nickname}
                {riga.userId === utente?.id && <span className="tenue"> (tu)</span>}
                {inParita && (
                  <span className="tenue nota"> · {formattaTempo(riga.totalMs)}</span>
                )}
              </span>
              <span className="punteggio">{riga.correctCount}</span>
            </li>
          )
        })}
      </ul>

      <button type="button" className="primario" onClick={esciDallaPartita}>
        Torna ai giochi
      </button>
    </div>
  )
}
