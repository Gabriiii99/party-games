// Lettura e validazione delle variabili d'ambiente.
// Meglio fallire subito all'avvio con un messaggio chiaro che scoprire a meta'
// partita che manca una chiave.

import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Su Render la porta viene iniettata dalla piattaforma.
  PORT: z.coerce.number().int().positive().default(3000),

  // Servono dalla Fase 1 (Prisma/Neon). Nella Fase 0 possono mancare.
  DATABASE_URL: z.string().optional(),
  DIRECT_URL: z.string().optional(),

  // Chiave di firma dei token di login.
  JWT_SECRET: z.string().optional(),
})

const parsed = schema.safeParse(process.env)
if (!parsed.success) {
  console.error('Variabili d\'ambiente non valide:')
  console.error(z.prettifyError(parsed.error))
  process.exit(1)
}

const raw = parsed.data
const inProduzione = raw.NODE_ENV === 'production'

// In produzione la chiave dei token e' obbligatoria e non puo' essere quella di sviluppo.
if (inProduzione && (!raw.JWT_SECRET || raw.JWT_SECRET.length < 32)) {
  console.error(
    'JWT_SECRET mancante o troppo corta (servono almeno 32 caratteri in produzione).',
  )
  process.exit(1)
}

export const env = {
  ...raw,
  inProduzione,
  /** In sviluppo si usa una chiave fissa: comoda, e i token non si invalidano a ogni riavvio. */
  JWT_SECRET: raw.JWT_SECRET || 'chiave-di-sviluppo-non-usare-in-produzione',
}
