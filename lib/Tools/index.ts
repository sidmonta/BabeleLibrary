import { curry, last, split, pipe } from 'ramda'
import { parse } from 'url'

const matched = <E>(x: E) => ({
  on: () => matched(x),
  otherwise: () => x
})

/**
 * Una versione funzionale dello switch case
 */
export const match = <T, E>(x: T) => ({
  on: (cond: (x: T) => boolean, fn: (x: T) => E) =>
    cond(x) ? matched(fn(x)) : match(x),
  otherwise: (fn: (x: T) => E) => fn(x)
})

/**
 * Una funzione che torna sempre TRUE
 */
const alwaysTrue = (...params: unknown[]) => true

/**
 * Rimuove un determinato carattere all'inizio o alla fine di una stringa
 */
const trimCh = curry((ch: string, x: string): string =>
  x.replace(new RegExp(`^${ch}+|${ch}+$`, 'g'), '')
)

/**
 * Controlla se una stringa è un URL valido
 * @param {string} str stringa da controllare
 */
export const validURL = (str: string) => {
  const pattern = new RegExp(
    '^(https?:\\/\\/)?' + // protocol
    '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
    '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
    '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
    '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
      '(\\#[-a-z\\d_]*)?$',
    'i'
  ) // fragment locator
  return !!pattern.test(str)
}

/**
 * Estrapola l'identificativo dall'URI di un elemento
 * @param uri URL dell'elemento
 */
export const getID: (uri: string) => string | undefined = uri => {
  let urld = parse(uri).path
  let get = pipe(trimCh('/'), split(/\/|#/), last)
  return urld ? get(uri) : undefined
}
