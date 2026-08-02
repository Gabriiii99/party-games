// Registro delle partite attive, con la generazione dei PIN.
//
// Il PIN e' la chiave con cui gli amici entrano, quindi deve essere unico solo tra le
// partite VIVE: quando una finisce, il suo codice torna disponibile. Sono sei cifre
// perche' si devono dettare a voce.

import type { GameType } from '@party/shared'
import { GameRoom } from './GameRoom'

/** Dopo quanto una partita abbandonata viene buttata via (2 ore). */
const SCADENZA_MS = 2 * 60 * 60 * 1000

export interface DatiCreazione {
  gameType: GameType
  hostId: string
  questionSetId: string
  titoloSet: string
  totalQuestions: number
}

export class GameManager {
  private readonly partite = new Map<string, GameRoom>()

  crea(dati: DatiCreazione): GameRoom {
    const stanza = new GameRoom({ pin: this.generaPin(), ...dati })
    this.partite.set(stanza.pin, stanza)
    return stanza
  }

  trova(pin: string): GameRoom | undefined {
    return this.partite.get(pin)
  }

  /** La partita a cui un utente sta gia' partecipando, se ce n'e' una. */
  trovaPerGiocatore(userId: string): GameRoom | undefined {
    for (const stanza of this.partite.values()) {
      if (stanza.trova(userId)) return stanza
    }
    return undefined
  }

  chiudi(pin: string): void {
    this.partite.delete(pin)
  }

  get numeroPartite(): number {
    return this.partite.size
  }

  /**
   * Toglie di mezzo le partite rimaste vuote o dimenticate. Senza questo, ogni
   * partita abbandonata terrebbe occupato il suo PIN e un po' di memoria fino al
   * prossimo riavvio.
   */
  pulisci(): number {
    const ora = Date.now()
    let rimosse = 0
    for (const [pin, stanza] of this.partite) {
      const scaduta = ora - stanza.creataIl > SCADENZA_MS
      if (stanza.vuota || scaduta || stanza.fase === 'ENDED') {
        this.partite.delete(pin)
        rimosse++
      }
    }
    return rimosse
  }

  private generaPin(): string {
    // Sei cifre = 900.000 combinazioni. Con le pochissime partite in contemporanea
    // di un'app tra amici, una collisione e' praticamente impossibile; il controllo
    // c'e' comunque perche' costa nulla.
    for (let tentativo = 0; tentativo < 50; tentativo++) {
      const pin = String(Math.floor(100000 + Math.random() * 900000))
      if (!this.partite.has(pin)) return pin
    }
    throw new Error('Non riesco a generare un PIN libero: troppe partite attive.')
  }
}

/** Istanza unica: le partite vivono qui, in questo processo. */
export const gameManager = new GameManager()
