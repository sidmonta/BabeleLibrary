import { curry } from 'ramda'

/**
 * @private
 * Oggetto restituito dal metodo match, finche non si esegue l'otherwise
 * @param x qualunque valore restituito dalla funzione `fn`
 */
const matched = <E>(x: E) => ({
  on: () => matched(x),
  otherwise: () => x
})

/**
 * Una versione funzionale dello switch case
 *
 * @example
 * const result = match(val)
 *                  .on((value) => value < 10, (value) => value + 10)
 *                  .on((value) => value < 20, (value) => value + 20)
 *                  .otherwise((value) => value + 50)
 * // val = 5
 * console.log(result) // => 15
 * // val = 14
 * console.log(result) // => 34
 * // val = 3003
 * console.log(result) // => 3053
 *
 * @param x valore che verrà matchato
 * @return un oggetto che supporta due funzioni:
 *
 *          1. `on(cond, fn)` dove cond è una funziona che controlla x,
 *              mentre fn è la funzione che deve essere eseguita se cond
 *              è soddisfatta
 *          2. `otherwise(fn)` dove fn è la funzione da eseguire se nessun
 *              controllo precedente è stato soddisfatto
 */
export const match = <T, E>(x: T) => ({
  on: (cond: (x: T) => boolean, fn: (x: T) => E) =>
    cond(x) ? matched(fn(x)) : match(x),
  otherwise: (fn: (x: T) => E) => fn(x)
})

/**
 * Una funzione che torna sempre TRUE indipendentemente dai parametri passati
 */
export const alwaysTrue = (...params: unknown[]) => true

/**
 * Rimuove un determinato carattere all'inizio o alla fine di una stringa
 */
export const trimCh = curry((ch: string, x: string): string =>
  x.replace(new RegExp(`^${ch}+|${ch}+$`, 'g'), '')
)

/**
 * Controlla se una stringa è un URL valido
 * @param {string} str stringa da controllare
 * @returns {boolean} se è un URL valido
 */
export const validURL = (str: string): boolean => {
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
