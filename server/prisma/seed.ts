// Domande di esempio, per poter giocare subito senza doverle scrivere.
//
// Lo script e' idempotente: si puo' rilanciare quante volte si vuole senza creare
// doppioni, perche' usa identificativi fissi invece di generarli a caso.
// Le domande dell'utente (Fase 5) vivranno accanto a queste, non al loro posto.

import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '../src/generated/prisma/client.js'

const qui = path.dirname(fileURLToPath(import.meta.url))
const percorsoEnv = path.resolve(qui, '../../.env')
if (existsSync(percorsoEnv)) process.loadEnvFile(percorsoEnv)

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('DATABASE_URL non impostata: non so a quale database parlare.')
  process.exit(1)
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })

// Identificativi fissi: sono la chiave dell'idempotenza.
const ID_AUTORE = 'utente-sistema'
const ID_SET = 'set-cultura-generale'

interface DomandaSeed {
  text: string
  options: string[]
  correctIndex: number
  vero_falso?: boolean
}

const DOMANDE: DomandaSeed[] = [
  {
    text: 'Qual e\' il fiume piu\' lungo d\'Italia?',
    options: ['Po', 'Adige', 'Tevere', 'Arno'],
    correctIndex: 0,
  },
  {
    text: 'In che anno e\' caduto il muro di Berlino?',
    options: ['1985', '1989', '1991', '1993'],
    correctIndex: 1,
  },
  {
    text: 'Quante zampe ha un ragno?',
    options: ['6', '8', '10', '12'],
    correctIndex: 1,
  },
  {
    text: 'Chi ha dipinto la Cappella Sistina?',
    options: ['Raffaello', 'Caravaggio', 'Michelangelo', 'Donatello'],
    correctIndex: 2,
  },
  {
    text: 'Qual e\' la capitale dell\'Australia?',
    options: ['Sydney', 'Melbourne', 'Canberra', 'Brisbane'],
    correctIndex: 2,
  },
  {
    text: 'Il pomodoro e\' botanicamente un frutto.',
    options: ['Vero', 'Falso'],
    correctIndex: 0,
    vero_falso: true,
  },
  {
    text: 'Quale pianeta e\' il piu\' vicino al Sole?',
    options: ['Venere', 'Marte', 'Mercurio', 'Terra'],
    correctIndex: 2,
  },
  {
    text: 'Quante regioni ha l\'Italia?',
    options: ['18', '19', '20', '21'],
    correctIndex: 2,
  },
  {
    text: 'Chi ha scritto "Il nome della rosa"?',
    options: ['Italo Calvino', 'Umberto Eco', 'Primo Levi', 'Dino Buzzati'],
    correctIndex: 1,
  },
  {
    text: 'La Grande Muraglia cinese e\' visibile a occhio nudo dalla Luna.',
    options: ['Vero', 'Falso'],
    correctIndex: 1,
    vero_falso: true,
  },
  {
    text: 'In quale anno l\'Italia ha vinto l\'ultimo Mondiale di calcio?',
    options: ['1982', '1994', '2006', '2010'],
    correctIndex: 2,
  },
  {
    text: 'Qual e\' l\'osso piu\' lungo del corpo umano?',
    options: ['Omero', 'Tibia', 'Femore', 'Perone'],
    correctIndex: 2,
  },
]

async function main(): Promise<void> {
  // Le domande di esempio hanno bisogno di un proprietario, ma nessuno deve poterci
  // entrare: la password e' un valore casuale che non viene mai mostrato.
  const passwordInutilizzabile = await bcrypt.hash(
    `${Math.random()}-${process.hrtime.bigint()}`,
    10,
  )

  const autore = await prisma.user.upsert({
    where: { id: ID_AUTORE },
    update: {},
    create: {
      id: ID_AUTORE,
      username: 'Party Games',
      usernameLower: 'party games',
      passwordHash: passwordInutilizzabile,
    },
  })

  const set = await prisma.questionSet.upsert({
    where: { id: ID_SET },
    update: { title: 'Cultura generale', description: 'Domande di esempio per iniziare.' },
    create: {
      id: ID_SET,
      title: 'Cultura generale',
      description: 'Domande di esempio per iniziare.',
      isPublic: true,
      ownerId: autore.id,
    },
  })

  // Si riscrivono da zero: se una domanda viene corretta qui, il database si allinea
  // invece di accumulare vecchie versioni.
  await prisma.question.deleteMany({ where: { questionSetId: set.id } })
  await prisma.question.createMany({
    data: DOMANDE.map((d, indice) => ({
      questionSetId: set.id,
      order: indice,
      type: d.vero_falso ? ('TRUE_FALSE' as const) : ('MULTIPLE_CHOICE' as const),
      text: d.text,
      options: d.options,
      correctIndex: d.correctIndex,
    })),
  })

  console.log(`[seed] set "${set.title}" pronto con ${DOMANDE.length} domande.`)
}

main()
  .catch((errore) => {
    console.error('[seed] fallito:', errore)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
