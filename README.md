# Party Games

Piccola app di giochi di gruppo da usare **tutti dal proprio telefono**: uno crea la partita e
detta un codice, gli altri entrano e si gioca insieme. Il primo gioco e' un **quiz live** con
classifica: un punto per ogni risposta corretta, e a parita' vince chi ha risposto piu' veloce.

## Come e' fatta

| Pezzo | Tecnologia |
| --- | --- |
| Backend | Node + Express + Socket.IO (TypeScript) |
| Frontend | React + Vite (TypeScript), pensato per il telefono |
| Database | PostgreSQL su [Neon](https://neon.com) tramite Prisma |
| Hosting | Un solo servizio su [Render](https://render.com): serve API, WebSocket e frontend |

Tre principi:

1. **Il server e' l'autorita'** — timer, correttezza e punteggi li decide il server. Il client
   mostra e raccoglie, niente di piu'.
2. **Contenuti nel database, partita in memoria** — account, domande e risultati finali sono
   persistiti; la partita in corso vive in RAM (dura pochi minuti).
3. **Un solo processo, un solo URL** in produzione — nessun problema di CORS, un unico link da
   mandare agli amici.

## Struttura

```
shared/   tipi e regole condivise (eventi socket, punteggio) — importati da server e client
server/   API REST, WebSocket, motore di gioco
client/   interfaccia React
```

Il pacchetto `shared` e' il motivo per cui il progetto e' un monorepo: i messaggi scambiati tra
client e server sono definiti una volta sola, quindi un payload sbagliato non compila.

## Avvio in locale

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

Apre due finestre (backend su `:3000`, frontend su `:5173`) e installa le dipendenze al primo
avvio. Poi apri <http://localhost:5173>.

In alternativa, due terminali:

```powershell
npm run dev:server
npm run dev:client
```

Altri comandi utili:

```powershell
npm run typecheck   # controlla i tipi su tutti i workspace
npm run build       # build di produzione del frontend
```

## Configurazione

Copia `.env.example` in `.env` e riempi i valori. Serve dalla Fase 1 (database); per il solo
scaffold l'app parte anche senza.

> Il file `.env` contiene la password del database ed e' in `.gitignore`: non va su GitHub.

## Database (Prisma + Neon)

Il CLI di Prisma sta nella **radice** del progetto, non in `server/`: cosi' i comandi si lanciano da
qui e trovano il `.env` che sta accanto a loro. La configurazione e' in `prisma.config.ts` perche'
da Prisma 7 il CLI **non carica piu' il `.env` da solo** e la stringa di connessione **non sta piu'
nello schema**.

Divisione delle due connessioni di Neon:

| Chi | Quale stringa | Dove e' configurata |
| --- | --- | --- |
| Migrazioni, seed, studio (CLI) | `DIRECT_URL` (diretta) | `prisma.config.ts` |
| App a runtime | `DATABASE_URL` (pooled) | `server/src/prisma.ts`, passata al driver adapter |

```powershell
npm run db:migrate    # crea/applica una migrazione in sviluppo
npm run db:generate   # rigenera il client (gira anche da solo dopo npm install)
npm run db:studio     # sfoglia i dati nel browser
```

Finche' `DATABASE_URL` e' vuota il server parte comunque: le rotte che usano il database
rispondono `503` con un messaggio che spiega cosa fare, invece di far crashare l'app.

## In produzione

L'app e' pubblicata su <https://party-games-hx3j.onrender.com> (Render, piano gratuito) e usa lo
**stesso database Neon** dello sviluppo locale: un account creato in locale funziona anche online.

Due conseguenze del piano gratuito, da ricordare la sera della partita:

- dopo ~15 minuti di inattivita' il servizio si addormenta e il primo che apre il link aspetta
  30-50 secondi. Conviene aprirlo qualche minuto prima di iniziare;
- **non pubblicare aggiornamenti durante una partita**: ogni deploy riavvia il server, e la partita
  in corso vive nella sua memoria.

Ogni `git push` sul ramo `main` fa ripartire la pubblicazione da solo.

## Promemoria per il deploy su Render

Due trappole da ricordare quando si arrivera' alla Fase 7:

1. Il comando di build deve usare **`npm install --include=dev`**. Con `NODE_ENV=production` npm
   salta le devDependencies, e senza di quelle mancherebbero `vite` (build del frontend) e `prisma`
   (migrazioni).
2. `tsx` sta nelle **dependencies** del server, non nelle devDependencies: serve a far girare il
   backend anche in produzione.

## Nota su `npm audit`

`npm audit` segnala alcuni avvisi (moderate) su `@hono/node-server` e `valibot`. Arrivano da
`@prisma/dev`, una dipendenza del **CLI di Prisma** che serve solo al comando `prisma dev` (avvia un
Postgres locale di prova). Questo progetto usa Neon e non invoca mai `prisma dev`, quindi quel
codice non gira ne' in sviluppo ne' in produzione: in produzione girano solo `@prisma/client` e
`@prisma/adapter-pg`.

Non vanno "risolti" con `npm audit fix --force`: quel comando alza Prisma a una versione con avvisi
piu' gravi. Le versioni di `prisma` e `@prisma/client` sono quindi fissate esatte (senza `^`) e
vanno alzate insieme.

## Stato di avanzamento

- [x] **Fase 0** — scaffold: monorepo, `/api/health`, proxy Vite, basi grafiche mobile
- [x] **Fase 1** — login e registrazione (username + password), tabelle create su Neon
- [x] **Fase 2** — lobby e ingresso con PIN (WebSocket, elenco giocatori in tempo reale)
- [x] **Fase 3** — ciclo delle domande, cronometro del server, punteggio e podio
- [ ] **Fase 4** — classifica, podio e albo d'oro
- [ ] **Fase 5** — editor delle domande e domande di esempio
- [ ] **Fase 6** — robustezza (riconnessioni, host che cade)
- [ ] **Fase 7** — PWA e deploy su Render
