// Cosa succede quando un socket manda un evento.
//
// Regola generale: il client CHIEDE, il server DECIDE. Ogni richiesta risponde con un
// esito esplicito (`ack`), cosi' il telefono sa sempre se l'azione e' andata a buon
// fine invece di restare in attesa muta.

import { GRAZIA_MS, nomeRoom, tempoValido, trovaGioco } from '@party/shared'
import { gameManager } from '../game/GameManager'
import type { GameRoom } from '../game/GameRoom'
import {
  avviaPartita,
  caricaDomande,
  chiudiDomanda,
  saltaAttesa,
} from '../game/quiz'
import { databaseConfigurato, getPrisma } from '../prisma'
import type { ServerIO, SocketPartita } from './io'

/** Manda a tutti i presenti la fotografia aggiornata della lobby. */
function emettiLobby(io: ServerIO, stanza: GameRoom): void {
  io.to(nomeRoom(stanza.pin)).emit('lobby:update', { stato: stanza.stato })
}

export function registraHandler(io: ServerIO, socket: SocketPartita): void {
  const { userId, username } = socket.data

  /**
   * Toglie l'utente dalla partita in cui si trovava. Si chiama prima di crearne o
   * entrarne in una nuova: senza, uno resterebbe fantasma in due lobby diverse.
   */
  function abbandonaPartitaCorrente(): void {
    const precedente = gameManager.trovaPerGiocatore(userId)
    if (!precedente) return

    precedente.rimuovi(userId)
    socket.leave(nomeRoom(precedente.pin))
    socket.data.pin = undefined
    sistemaDopoUscita(precedente)
  }

  /** Dopo che qualcuno se n'e' andato: passa il comando o chiudi la stanza. */
  function sistemaDopoUscita(stanza: GameRoom): void {
    if (stanza.numeroConnessi === 0) {
      gameManager.chiudi(stanza.pin)
      return
    }

    // Se se n'e' andato proprio l'host, il comando passa a chi e' arrivato per primo
    // tra i presenti: la partita non deve morire perche' uno ha chiuso la scheda.
    if (!stanza.trova(stanza.hostId)) {
      const erede = stanza.candidatoHost() ?? stanza.elenco.find((g) => g.connected)
      if (erede) {
        stanza.hostId = erede.userId
        io.to(nomeRoom(stanza.pin)).emit('host:changed', {
          newHostId: erede.userId,
          nickname: erede.nickname,
        })
      }
    }

    emettiLobby(io, stanza)
  }

  // --- Creazione partita ----------------------------------------------------------

  socket.on('game:create', async (payload, ack) => {
    if (!databaseConfigurato) {
      ack({ ok: false, error: 'server_error', message: 'Database non configurato.' })
      return
    }

    const gioco = trovaGioco(payload?.gameType ?? '')
    if (!gioco || !gioco.disponibile) {
      ack({ ok: false, error: 'invalid', message: 'Gioco non disponibile.' })
      return
    }

    try {
      const set = await getPrisma().questionSet.findUnique({
        where: { id: payload.questionSetId },
        select: { id: true, title: true, _count: { select: { questions: true } } },
      })

      if (!set) {
        ack({ ok: false, error: 'not_found', message: 'Pacchetto di domande inesistente.' })
        return
      }
      if (set._count.questions === 0) {
        ack({ ok: false, error: 'invalid', message: 'Questo pacchetto non ha domande.' })
        return
      }

      abbandonaPartitaCorrente()

      const stanza = gameManager.crea({
        gameType: gioco.id,
        hostId: userId,
        questionSetId: set.id,
        titoloSet: set.title,
        totalQuestions: set._count.questions,
      })
      stanza.aggiungi(userId, username, socket.id)

      socket.join(nomeRoom(stanza.pin))
      socket.data.pin = stanza.pin

      ack({ ok: true, stato: stanza.stato })
      emettiLobby(io, stanza)
      console.log(`[gioco] ${username} ha creato la partita ${stanza.pin}`)
    } catch (e) {
      console.error('[gioco] errore in game:create', e)
      ack({ ok: false, error: 'server_error', message: 'Non riesco a creare la partita.' })
    }
  })

  // --- Ingresso con PIN -------------------------------------------------------------

  socket.on('game:join', (payload, ack) => {
    const pin = String(payload?.pin ?? '').trim()
    const stanza = gameManager.trova(pin)

    if (!stanza) {
      ack({ ok: false, error: 'not_found', message: 'Nessuna partita con questo codice.' })
      return
    }

    // Chi era gia' dentro puo' rientrare anche a partita iniziata (gli capitera' se
    // cade la linea); chi e' nuovo, no: si entra solo prima del via.
    const giaDentro = Boolean(stanza.trova(userId))
    if (stanza.fase !== 'LOBBY' && !giaDentro) {
      ack({
        ok: false,
        error: 'in_progress',
        message: 'Partita già iniziata: aspetta la prossima.',
      })
      return
    }

    if (!giaDentro) abbandonaPartitaCorrente()

    stanza.aggiungi(userId, username, socket.id)
    socket.join(nomeRoom(stanza.pin))
    socket.data.pin = stanza.pin

    ack({ ok: true, stato: stanza.stato })
    emettiLobby(io, stanza)
    console.log(`[gioco] ${username} e' entrato nella partita ${pin}`)
  })

  // --- Impostazioni della lobby --------------------------------------------------------

  socket.on('lobby:settings', (payload, ack) => {
    const stanza = socket.data.pin ? gameManager.trova(socket.data.pin) : undefined
    if (!stanza) {
      ack({ ok: false, error: 'not_found', message: 'Non sei in nessuna partita.' })
      return
    }
    if (!stanza.eHost(userId)) {
      ack({ ok: false, error: 'not_host', message: 'Solo chi ha creato la partita può cambiare il tempo.' })
      return
    }
    if (stanza.fase !== 'LOBBY') {
      ack({ ok: false, error: 'in_progress', message: 'La partita è già iniziata.' })
      return
    }
    // Il valore va estratto prima: cosi' il controllo restringe davvero il tipo di
    // cio' che verra' usato, e non si puo' passare oltre una durata fuori elenco.
    const secondi = payload?.timeLimitSec ?? 0
    if (!tempoValido(secondi)) {
      ack({ ok: false, error: 'invalid', message: 'Durata non ammessa.' })
      return
    }

    stanza.impostaTempo(secondi)
    ack({ ok: true })
    emettiLobby(io, stanza)
  })

  // --- Avvio della partita -----------------------------------------------------------

  socket.on('game:start', async (ack) => {
    const stanza = socket.data.pin ? gameManager.trova(socket.data.pin) : undefined
    if (!stanza) {
      ack({ ok: false, error: 'not_found', message: 'Non sei in nessuna partita.' })
      return
    }
    if (!stanza.eHost(userId)) {
      ack({ ok: false, error: 'not_host', message: 'Solo chi ha creato la partita può avviarla.' })
      return
    }
    if (stanza.fase !== 'LOBBY') {
      ack({ ok: false, error: 'in_progress', message: 'La partita è già iniziata.' })
      return
    }

    const minimo = trovaGioco(stanza.gameType)?.minGiocatori ?? 2
    if (stanza.numeroConnessi < minimo) {
      ack({
        ok: false,
        error: 'not_enough_players',
        message: `Servono almeno ${minimo} giocatori.`,
      })
      return
    }

    try {
      const quante = await caricaDomande(stanza)
      if (quante === 0) {
        ack({ ok: false, error: 'invalid', message: 'Questo pacchetto non ha domande.' })
        return
      }
      ack({ ok: true })
      avviaPartita(io, stanza)
      console.log(`[gioco] partita ${stanza.pin} avviata con ${quante} domande`)
    } catch (e) {
      console.error('[gioco] errore in game:start', e)
      ack({ ok: false, error: 'server_error', message: 'Non riesco a caricare le domande.' })
    }
  })

  // --- Risposte -------------------------------------------------------------------------

  socket.on('answer:submit', (payload, ack) => {
    const stanza = socket.data.pin ? gameManager.trova(socket.data.pin) : undefined
    if (!stanza) {
      ack({ ok: false, error: 'not_found', message: 'Non sei in nessuna partita.' })
      return
    }

    const esito = stanza.registraRisposta(
      userId,
      payload?.questionIndex ?? -1,
      payload?.optionIndex ?? -1,
      GRAZIA_MS,
    )

    socket.emit('answer:ack', {
      accepted: esito.accettata,
      questionIndex: payload?.questionIndex ?? -1,
    })
    ack({ ok: true })

    // Se hanno risposto tutti non ha senso guardare il cronometro scorrere a vuoto:
    // si chiude subito e si passa alla rivelazione.
    if (esito.accettata && stanza.tuttiHannoRisposto) {
      chiudiDomanda(io, stanza)
    }
  })

  // --- Salto dell'attesa sul risultato ----------------------------------------------------

  socket.on('game:next', (ack) => {
    const stanza = socket.data.pin ? gameManager.trova(socket.data.pin) : undefined
    if (!stanza) {
      ack({ ok: false, error: 'not_found', message: 'Non sei in nessuna partita.' })
      return
    }
    if (!stanza.eHost(userId)) {
      ack({ ok: false, error: 'not_host', message: 'Solo il capo partita può andare avanti.' })
      return
    }
    ack({ ok: true })
    saltaAttesa(io, stanza)
  })

  // --- Uscita e caduta di linea ----------------------------------------------------------

  socket.on('game:leave', () => {
    abbandonaPartitaCorrente()
  })

  socket.on('disconnect', (motivo) => {
    const stanza = socket.data.pin ? gameManager.trova(socket.data.pin) : undefined
    if (!stanza) return

    // Se l'utente ha nel frattempo aperto un'altra scheda, la stanza punta al socket
    // nuovo: la chiusura di quello vecchio non deve buttarlo fuori.
    const giocatore = stanza.trova(userId)
    if (!giocatore || (giocatore.socketId && giocatore.socketId !== socket.id)) return

    stanza.segnaDisconnesso(userId)
    sistemaDopoUscita(stanza)
    console.log(`[gioco] ${username} si e' scollegato dalla partita ${stanza.pin} (${motivo})`)
  })
}
