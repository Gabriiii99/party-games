// Carica il file .env dalla radice del progetto usando la funzione nativa di Node
// (nessuna dipendenza tipo dotenv). Va importato PRIMA di env.ts: gli import ESM
// vengono eseguiti nell'ordine in cui sono scritti.
//
// Su Render il file .env non esiste: le variabili sono iniettate dalla piattaforma.

import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const qui = path.dirname(fileURLToPath(import.meta.url))
const percorsoEnv = path.resolve(qui, '../../.env')

if (existsSync(percorsoEnv)) {
  process.loadEnvFile(percorsoEnv)
  console.log(`[env] caricato: ${percorsoEnv}`)
} else {
  console.log('[env] nessun file .env trovato (normale su Render, e in Fase 0 in locale)')
}
