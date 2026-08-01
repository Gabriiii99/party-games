// Le password non vengono mai salvate in chiaro: solo il loro hash bcrypt.
// Si usa bcryptjs (JavaScript puro) e non bcrypt nativo, che richiederebbe una
// compilazione C++ fragile su Windows e su alcuni hosting.

import bcrypt from 'bcryptjs'

/** Costo del calcolo: 10 e' il compromesso standard tra sicurezza e velocita'. */
const COSTO = 10

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COSTO)
}

export function verificaPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}
