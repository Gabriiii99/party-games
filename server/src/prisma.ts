// Accesso al database. Una sola istanza di PrismaClient per tutto il processo:
// ognuna aprirebbe un proprio pool di connessioni, e Neon ha un limite.
//
// Da Prisma 7 serve un "driver adapter": qui si usa quello per Postgres, a cui si
// passa la connessione POOLED di Neon (le migrazioni usano invece quella diretta,
// vedi prisma.config.ts).
//
// Se DATABASE_URL non e' ancora configurata il server parte comunque: le rotte che
// hanno bisogno del database risponderanno con un messaggio chiaro invece di
// crashare all'avvio.

import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/prisma/client.js'
import { env } from './env'

export const databaseConfigurato = Boolean(env.DATABASE_URL)

let istanza: PrismaClient | null = null

export function getPrisma(): PrismaClient {
  if (!istanza) {
    if (!env.DATABASE_URL) {
      throw new Error(
        'DATABASE_URL non impostata: copia .env.example in .env e incolla le stringhe di Neon.',
      )
    }
    istanza = new PrismaClient({
      adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
    })
  }
  return istanza
}

export async function chiudiPrisma(): Promise<void> {
  if (istanza) {
    await istanza.$disconnect()
    istanza = null
  }
}
