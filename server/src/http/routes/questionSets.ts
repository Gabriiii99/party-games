// Pacchetti di domande: elenco, lettura, creazione, modifica, cancellazione.
//
// Un pacchetto si salva sempre INTERO: titolo e domande insieme, in una transazione.
// Salvare domanda per domanda avrebbe voluto dire gestire stati intermedi (una
// modifica riuscita a metà) per un guadagno nullo: i pacchetti sono piccoli.

import { Router } from 'express'
import { z } from 'zod'
import { getPrisma } from '../../prisma'
import { richiedeDatabase, richiedeLogin } from '../middleware/auth'

export const questionSetsRouter = Router()

const MAX_OPZIONI = 4
const MAX_DOMANDE = 100

const schemaDomanda = z
  .object({
    type: z.enum(['MULTIPLE_CHOICE', 'TRUE_FALSE']).default('MULTIPLE_CHOICE'),
    text: z.string().trim().min(1, 'Ogni domanda deve avere un testo.').max(300),
    options: z
      .array(z.string().trim().min(1, 'Le risposte non possono essere vuote.').max(120))
      .min(2, 'Servono almeno due risposte.')
      .max(MAX_OPZIONI, `Al massimo ${MAX_OPZIONI} risposte.`),
    correctIndex: z.number().int().min(0),
  })
  // Si controlla qui e non solo nel client: il client si può aggirare, questo no.
  .refine((d) => d.correctIndex < d.options.length, {
    message: 'La risposta corretta indicata non esiste.',
    path: ['correctIndex'],
  })

const schemaPacchetto = z.object({
  title: z.string().trim().min(1, 'Serve un titolo.').max(80),
  description: z.string().trim().max(200).optional().nullable(),
  questions: z
    .array(schemaDomanda)
    .min(1, 'Serve almeno una domanda.')
    .max(MAX_DOMANDE, `Al massimo ${MAX_DOMANDE} domande.`),
})

function primoErrore(errore: z.ZodError): string {
  return errore.issues[0]?.message ?? 'Dati non validi.'
}

/**
 * In Express 5 un parametro d'URL è tipizzato `string | string[]` (per via delle rotte
 * con caratteri jolly). Qui è sempre uno solo: si restringe una volta, invece di
 * trascinarsi l'incertezza dentro ogni query.
 */
function parametroId(valore: string | string[] | undefined): string {
  return Array.isArray(valore) ? (valore[0] ?? '') : (valore ?? '')
}

// --- Elenco -------------------------------------------------------------------

questionSetsRouter.get('/question-sets', richiedeDatabase, richiedeLogin, async (req, res) => {
  const utente = req.utente!

  const set = await getPrisma().questionSet.findMany({
    where: { OR: [{ isPublic: true }, { ownerId: utente.userId }] },
    select: {
      id: true,
      title: true,
      description: true,
      ownerId: true,
      _count: { select: { questions: true } },
      owner: { select: { username: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  res.json({
    set: set.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      numeroDomande: s._count.questions,
      autore: s.owner.username,
      /** Solo chi l'ha creato può modificarlo: al client serve per mostrare o no la matita. */
      mio: s.ownerId === utente.userId,
    })),
  })
})

// --- Lettura di un pacchetto con le sue domande -----------------------------------

questionSetsRouter.get('/question-sets/:id', richiedeDatabase, richiedeLogin, async (req, res) => {
  const utente = req.utente!

  const set = await getPrisma().questionSet.findUnique({
    where: { id: parametroId(req.params.id) },
    select: {
      id: true,
      title: true,
      description: true,
      ownerId: true,
      isPublic: true,
      questions: {
        orderBy: { order: 'asc' },
        select: { type: true, text: true, options: true, correctIndex: true },
      },
    },
  })

  if (!set || (!set.isPublic && set.ownerId !== utente.userId)) {
    res.status(404).json({ error: 'not_found', message: 'Pacchetto inesistente.' })
    return
  }

  res.json({
    id: set.id,
    title: set.title,
    description: set.description,
    mio: set.ownerId === utente.userId,
    questions: set.questions,
  })
})

// --- Creazione ------------------------------------------------------------------

questionSetsRouter.post('/question-sets', richiedeDatabase, richiedeLogin, async (req, res) => {
  const utente = req.utente!
  const dati = schemaPacchetto.safeParse(req.body)
  if (!dati.success) {
    res.status(400).json({ error: 'invalid', message: primoErrore(dati.error) })
    return
  }

  const creato = await getPrisma().questionSet.create({
    data: {
      title: dati.data.title,
      description: dati.data.description ?? null,
      isPublic: true, // tra amici ha senso che i pacchetti si vedano tutti
      ownerId: utente.userId,
      questions: {
        create: dati.data.questions.map((d, indice) => ({
          order: indice,
          type: d.type,
          text: d.text,
          options: d.options,
          correctIndex: d.correctIndex,
        })),
      },
    },
    select: { id: true },
  })

  res.status(201).json({ id: creato.id })
})

// --- Modifica --------------------------------------------------------------------

questionSetsRouter.put('/question-sets/:id', richiedeDatabase, richiedeLogin, async (req, res) => {
  const utente = req.utente!
  const dati = schemaPacchetto.safeParse(req.body)
  if (!dati.success) {
    res.status(400).json({ error: 'invalid', message: primoErrore(dati.error) })
    return
  }

  const prisma = getPrisma()
  const idPacchetto = parametroId(req.params.id)
  const esistente = await prisma.questionSet.findUnique({
    where: { id: idPacchetto },
    select: { ownerId: true },
  })

  if (!esistente) {
    res.status(404).json({ error: 'not_found', message: 'Pacchetto inesistente.' })
    return
  }
  if (esistente.ownerId !== utente.userId) {
    res.status(403).json({
      error: 'non_tuo',
      message: 'Questo pacchetto non è tuo: puoi solo giocarci.',
    })
    return
  }

  // Le domande si riscrivono da zero. Tenere traccia di quali sono cambiate,
  // aggiunte o spostate costerebbe molto codice per risparmiare una manciata di
  // righe riscritte. La transazione garantisce che non resti mai un pacchetto
  // svuotato a metà.
  await prisma.$transaction([
    prisma.question.deleteMany({ where: { questionSetId: idPacchetto } }),
    prisma.questionSet.update({
      where: { id: idPacchetto },
      data: {
        title: dati.data.title,
        description: dati.data.description ?? null,
        questions: {
          create: dati.data.questions.map((d, indice) => ({
            order: indice,
            type: d.type,
            text: d.text,
            options: d.options,
            correctIndex: d.correctIndex,
          })),
        },
      },
    }),
  ])

  res.json({ ok: true })
})

// --- Cancellazione ----------------------------------------------------------------

questionSetsRouter.delete(
  '/question-sets/:id',
  richiedeDatabase,
  richiedeLogin,
  async (req, res) => {
    const utente = req.utente!
    const prisma = getPrisma()
    const idPacchetto = parametroId(req.params.id)

    const esistente = await prisma.questionSet.findUnique({
      where: { id: idPacchetto },
      select: { ownerId: true },
    })

    if (!esistente) {
      res.status(404).json({ error: 'not_found', message: 'Pacchetto inesistente.' })
      return
    }
    if (esistente.ownerId !== utente.userId) {
      res.status(403).json({ error: 'non_tuo', message: 'Questo pacchetto non è tuo.' })
      return
    }

    // Le partite già giocate restano nell'albo d'oro: il collegamento al pacchetto
    // si azzera (onDelete: SetNull), la storia no.
    await prisma.questionSet.delete({ where: { id: idPacchetto } })
    res.json({ ok: true })
  },
)
