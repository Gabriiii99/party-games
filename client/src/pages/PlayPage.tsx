// La domanda: quattro tasselli grandi e il tempo che scorre.
// Una volta risposto non si torna indietro: il tocco è definitivo, come a Kahoot.

import { usePartita } from '../lib/partita'
import { useTempoRimasto } from '../lib/useTempoRimasto'

export function PlayPage() {
  const { domanda, miaRisposta, rispondi } = usePartita()
  const rimastoMs = useTempoRimasto(domanda?.deadlineTs ?? null, domanda?.scartoMs ?? 0)

  if (!domanda) return null

  const secondi = Math.ceil(rimastoMs / 1000)
  const frazione = domanda.durationMs > 0 ? rimastoMs / domanda.durationMs : 0
  const haRisposto = miaRisposta !== null
  const tempoFinito = rimastoMs === 0

  return (
    <div className="pagina">
      <div className="barra-alta">
        <span className="tenue">
          Domanda {domanda.index + 1} di {domanda.total}
        </span>
        <span className={`contatore ${secondi <= 5 ? 'urgente' : ''}`}>{secondi}</span>
      </div>

      {/* La barra dà il colpo d'occhio, il numero dà la precisione. */}
      <div
        className="barra-tempo"
        role="timer"
        aria-label={`${secondi} secondi rimasti`}
      >
        <div className="barra-tempo-pieno" style={{ transform: `scaleX(${frazione})` }} />
      </div>

      <h1 className="testo-domanda">{domanda.question.text}</h1>

      <div className={`griglia-risposte ${domanda.question.options.length === 2 ? 'due' : ''}`}>
        {domanda.question.options.map((opzione, indice) => (
          <button
            key={indice}
            type="button"
            className={`tassello colore-${indice + 1} ${
              miaRisposta === indice ? 'scelto' : ''
            } ${haRisposto && miaRisposta !== indice ? 'scartato' : ''}`}
            disabled={haRisposto || tempoFinito}
            onClick={() => rispondi(indice)}
          >
            {opzione}
          </button>
        ))}
      </div>

      <p className="tenue nota attesa-risposta">
        {haRisposto
          ? 'Risposta inviata. Aspetta gli altri...'
          : tempoFinito
            ? 'Tempo scaduto.'
            : 'Tocca la risposta che credi giusta.'}
      </p>
    </div>
  )
}
