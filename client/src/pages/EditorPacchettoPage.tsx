// Scrittura delle domande.
//
// Si modifica tutto in locale e si salva con un solo tocco: su un telefono, salvare a
// ogni carattere significherebbe una richiesta di rete ogni tasto premuto, e un
// pacchetto a metà se la connessione cade nel mezzo.

import { useEffect, useState } from 'react'
import { api } from '../lib/api'

type TipoDomanda = 'MULTIPLE_CHOICE' | 'TRUE_FALSE'

interface DomandaBozza {
  /** Chiave locale: serve a React per non confondere le righe mentre si riordina. */
  chiave: number
  type: TipoDomanda
  text: string
  options: string[]
  correctIndex: number
}

const MAX_OPZIONI = 4
const VERO_FALSO = ['Vero', 'Falso']

let prossimaChiave = 1
const nuovaDomanda = (): DomandaBozza => ({
  chiave: prossimaChiave++,
  type: 'MULTIPLE_CHOICE',
  text: '',
  options: ['', '', '', ''],
  correctIndex: 0,
})

export function EditorPacchettoPage({
  id,
  chiudi,
}: {
  id: string | null
  chiudi: (salvato: boolean) => void
}) {
  const [titolo, setTitolo] = useState('')
  const [descrizione, setDescrizione] = useState('')
  const [domande, setDomande] = useState<DomandaBozza[]>([nuovaDomanda()])
  const [caricamento, setCaricamento] = useState(id !== null)
  const [salvataggio, setSalvataggio] = useState(false)
  const [messaggio, setMessaggio] = useState<string | null>(null)

  useEffect(() => {
    if (id === null) return
    let annullato = false
    api
      .get<{
        title: string
        description: string | null
        questions: { type: TipoDomanda; text: string; options: string[]; correctIndex: number }[]
      }>(`/question-sets/${id}`)
      .then((dati) => {
        if (annullato) return
        setTitolo(dati.title)
        setDescrizione(dati.description ?? '')
        setDomande(
          dati.questions.map((d) => ({
            chiave: prossimaChiave++,
            type: d.type,
            text: d.text,
            // Si riempie fino a quattro caselle: aggiungere una risposta deve essere
            // scrivere in una casella vuota, non cercare un pulsante.
            options:
              d.type === 'TRUE_FALSE'
                ? [...VERO_FALSO]
                : [...d.options, '', '', '', ''].slice(0, MAX_OPZIONI),
            correctIndex: d.correctIndex,
          })),
        )
      })
      .catch((e) => {
        if (!annullato) setMessaggio(e instanceof Error ? e.message : 'Non riesco a leggere il pacchetto.')
      })
      .finally(() => {
        if (!annullato) setCaricamento(false)
      })
    return () => {
      annullato = true
    }
  }, [id])

  const modifica = (chiave: number, cambio: Partial<DomandaBozza>) =>
    setDomande((attuali) =>
      attuali.map((d) => (d.chiave === chiave ? { ...d, ...cambio } : d)),
    )

  const cambiaTipo = (d: DomandaBozza, tipo: TipoDomanda) =>
    modifica(d.chiave, {
      type: tipo,
      options: tipo === 'TRUE_FALSE' ? [...VERO_FALSO] : ['', '', '', ''],
      correctIndex: 0,
    })

  const cambiaOpzione = (d: DomandaBozza, indice: number, valore: string) => {
    const opzioni = [...d.options]
    opzioni[indice] = valore
    modifica(d.chiave, { options: opzioni })
  }

  const salva = async () => {
    setMessaggio(null)

    // Si validano qui i casi comuni, per dire subito cosa manca e dove. Il server
    // ricontrolla comunque tutto: questo è per la fretta, non per la sicurezza.
    const pulite = domande.map((d) => ({
      type: d.type,
      text: d.text.trim(),
      options: d.options.map((o) => o.trim()).filter((o) => o !== ''),
      correctIndex: d.correctIndex,
    }))

    if (titolo.trim() === '') return setMessaggio('Dai un titolo al pacchetto.')
    if (pulite.length === 0) return setMessaggio('Serve almeno una domanda.')

    for (const [i, d] of pulite.entries()) {
      if (d.text === '') return setMessaggio(`La domanda ${i + 1} non ha testo.`)
      if (d.options.length < 2) return setMessaggio(`La domanda ${i + 1} ha meno di due risposte.`)
      // Le caselle vuote scompaiono: se la risposta giusta era dopo una casella
      // saltata, l'indice non punterebbe più dove crede l'utente.
      const originale = domande[i].options.map((o) => o.trim())
      const testoGiusto = originale[domande[i].correctIndex] ?? ''
      const nuovoIndice = d.options.indexOf(testoGiusto)
      if (testoGiusto === '' || nuovoIndice === -1) {
        return setMessaggio(`Nella domanda ${i + 1} segna quale risposta è quella giusta.`)
      }
      d.correctIndex = nuovoIndice
    }

    setSalvataggio(true)
    try {
      const corpo = {
        title: titolo.trim(),
        description: descrizione.trim() || null,
        questions: pulite,
      }
      if (id === null) await api.post('/question-sets', corpo)
      else await api.put(`/question-sets/${id}`, corpo)
      chiudi(true)
    } catch (e) {
      setMessaggio(e instanceof Error ? e.message : 'Non riesco a salvare.')
    } finally {
      setSalvataggio(false)
    }
  }

  if (caricamento) {
    return (
      <div className="pagina centrata">
        <span className="stato">
          <span className="stato-pallino attesa" />
          Apro il pacchetto...
        </span>
      </div>
    )
  }

  return (
    <div className="pagina">
      <div className="barra-alta">
        <div className="logo">
          <span className="logo-punto" />
          {id === null ? 'Nuovo pacchetto' : 'Modifica'}
        </div>
        <button type="button" className="collegamento" onClick={() => chiudi(false)}>
          Annulla
        </button>
      </div>

      <div className="scheda">
        <label className="campo">
          <span>Titolo</span>
          <input
            value={titolo}
            onChange={(e) => setTitolo(e.target.value)}
            placeholder="Es. Musica anni 90"
            maxLength={80}
          />
        </label>
        <label className="campo">
          <span>Descrizione (facoltativa)</span>
          <input
            value={descrizione}
            onChange={(e) => setDescrizione(e.target.value)}
            placeholder="Due righe per ricordarti cos'è"
            maxLength={200}
          />
        </label>
      </div>

      {domande.map((d, indice) => (
        <div className="scheda" key={d.chiave}>
          <div className="barra-alta">
            <h2>Domanda {indice + 1}</h2>
            <button
              type="button"
              className="collegamento"
              onClick={() => setDomande((a) => a.filter((x) => x.chiave !== d.chiave))}
              disabled={domande.length === 1}
            >
              Togli
            </button>
          </div>

          <label className="campo">
            <span>Testo</span>
            <input
              value={d.text}
              onChange={(e) => modifica(d.chiave, { text: e.target.value })}
              placeholder="Chi ha vinto Sanremo nel 1994?"
              maxLength={300}
            />
          </label>

          <div className="riga-azioni">
            <button
              type="button"
              className={d.type === 'MULTIPLE_CHOICE' ? 'primario' : undefined}
              onClick={() => cambiaTipo(d, 'MULTIPLE_CHOICE')}
            >
              Risposta multipla
            </button>
            <button
              type="button"
              className={d.type === 'TRUE_FALSE' ? 'primario' : undefined}
              onClick={() => cambiaTipo(d, 'TRUE_FALSE')}
            >
              Vero o falso
            </button>
          </div>

          <p className="tenue nota">Tocca il pallino della risposta giusta.</p>

          {d.options.map((opzione, i) => (
            <label className="riga-opzione" key={i}>
              <input
                type="radio"
                name={`giusta-${d.chiave}`}
                checked={d.correctIndex === i}
                onChange={() => modifica(d.chiave, { correctIndex: i })}
              />
              <input
                value={opzione}
                onChange={(e) => cambiaOpzione(d, i, e.target.value)}
                placeholder={`Risposta ${i + 1}${i > 1 ? ' (facoltativa)' : ''}`}
                disabled={d.type === 'TRUE_FALSE'}
                maxLength={120}
              />
            </label>
          ))}
        </div>
      ))}

      <button type="button" onClick={() => setDomande((a) => [...a, nuovaDomanda()])}>
        Aggiungi domanda
      </button>

      {messaggio && <p className="messaggio-errore">{messaggio}</p>}

      <button type="button" className="primario" onClick={salva} disabled={salvataggio}>
        {salvataggio ? 'Salvo...' : 'Salva il pacchetto'}
      </button>
    </div>
  )
}
