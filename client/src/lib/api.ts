// Piccolo wrapper sulle chiamate REST al backend.
// Si usa sempre un percorso relativo (/api/...): in sviluppo lo inoltra il proxy di
// Vite, in produzione backend e frontend sono lo stesso server.

const CHIAVE_TOKEN = 'party-games.token'

export function leggiToken(): string | null {
  return localStorage.getItem(CHIAVE_TOKEN)
}

export function salvaToken(token: string): void {
  localStorage.setItem(CHIAVE_TOKEN, token)
}

export function cancellaToken(): void {
  localStorage.removeItem(CHIAVE_TOKEN)
}

export class ErroreApi extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ErroreApi'
  }
}

async function richiesta<T>(
  metodo: 'GET' | 'POST' | 'PUT' | 'DELETE',
  percorso: string,
  corpo?: unknown,
): Promise<T> {
  const token = leggiToken()
  const risposta = await fetch(`/api${percorso}`, {
    method: metodo,
    headers: {
      ...(corpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
  })

  if (!risposta.ok) {
    // Il backend risponde con { error, message }: si prova a usare quel messaggio.
    let messaggio = `Errore ${risposta.status}`
    try {
      const dati = (await risposta.json()) as { message?: string; error?: string }
      messaggio = dati.message ?? dati.error ?? messaggio
    } catch {
      // corpo non JSON: si tiene il messaggio generico
    }
    throw new ErroreApi(risposta.status, messaggio)
  }

  return (await risposta.json()) as T
}

export const api = {
  get: <T>(percorso: string) => richiesta<T>('GET', percorso),
  post: <T>(percorso: string, corpo?: unknown) => richiesta<T>('POST', percorso, corpo),
  put: <T>(percorso: string, corpo?: unknown) => richiesta<T>('PUT', percorso, corpo),
  del: <T>(percorso: string) => richiesta<T>('DELETE', percorso),
}

// --- Tipi delle risposte ------------------------------------------------------

export interface RispostaHealth {
  ok: boolean
  servizio: string
  versione: string
  uptimeSec: number
}
