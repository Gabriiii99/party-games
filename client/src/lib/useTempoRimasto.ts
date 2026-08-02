// Conto alla rovescia sincronizzato con il server.
//
// Il tempo rimasto si RICALCOLA a ogni battito partendo dalla scadenza, invece di
// scalare un contatore locale: un contatore accumulerebbe l'errore di ogni battito e
// dopo trenta secondi mostrerebbe un numero diverso su ogni telefono.
//
// `scartoMs` è la differenza stimata tra l'orologio del telefono e quello del server:
// gli orologi dei telefoni non sono d'accordo tra loro, quello del server è l'unico
// che conta.

import { useEffect, useState } from 'react'

export function useTempoRimasto(deadlineTs: number | null, scartoMs: number): number {
  const [rimastoMs, setRimastoMs] = useState(0)

  useEffect(() => {
    if (deadlineTs === null) {
      setRimastoMs(0)
      return
    }

    const calcola = () => Math.max(0, deadlineTs - (Date.now() + scartoMs))
    setRimastoMs(calcola())

    // 100ms: abbastanza fluido per una barra che si svuota, abbastanza raro da non
    // far lavorare il telefono per nulla.
    const battito = setInterval(() => setRimastoMs(calcola()), 100)
    return () => clearInterval(battito)
  }, [deadlineTs, scartoMs])

  return rimastoMs
}
