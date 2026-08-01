// Configurazione del CLI di Prisma (migrazioni, generate, seed, studio).
// Da Prisma 7 il CLI non legge piu' il .env da solo e la stringa di connessione
// non sta piu' nello schema: si dichiarano qui.
//
// I percorsi sono relativi alla posizione di QUESTO file (la radice del progetto).

import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'prisma/config'

const qui = path.dirname(fileURLToPath(import.meta.url))
const percorsoEnv = path.resolve(qui, '.env')

if (existsSync(percorsoEnv)) {
  process.loadEnvFile(percorsoEnv)
}

// Le migrazioni usano la connessione DIRETTA di Neon (non passano dal pooler).
// L'app a runtime usa invece DATABASE_URL, la versione "pooled".
const urlMigrazioni = process.env.DIRECT_URL || process.env.DATABASE_URL || ''

if (!urlMigrazioni) {
  console.warn(
    '\n[prisma] DIRECT_URL e DATABASE_URL non impostate.\n' +
      '         Copia .env.example in .env e incolla le due stringhe di Neon.\n' +
      '         (Serve solo per i comandi che parlano col database: migrate, seed, studio.)\n',
  )
}

export default defineConfig({
  schema: 'server/prisma/schema.prisma',
  migrations: {
    path: 'server/prisma/migrations',
    seed: 'tsx server/prisma/seed.ts',
  },
  datasource: {
    url: urlMigrazioni,
  },
})
