// Registro dei giochi disponibili nell'app.
// Per aggiungere un gioco in futuro: una voce qui + un engine lato server.

export type GameType = 'quiz'

export interface GameDefinition {
  id: GameType
  nome: string
  descrizione: string
  /** Sotto questo numero di giocatori l'host non puo' avviare. */
  minGiocatori: number
  /** false = mostrato nell'hub come "in arrivo", non avviabile. */
  disponibile: boolean
}

export const GIOCHI: readonly GameDefinition[] = [
  {
    id: 'quiz',
    nome: 'Quiz',
    descrizione: 'Domande a risposta multipla, tutti insieme. Un punto per ogni risposta giusta.',
    minGiocatori: 2,
    disponibile: true,
  },
]

export function trovaGioco(id: string): GameDefinition | undefined {
  return GIOCHI.find((g) => g.id === id)
}
