import { curry, last, split, pipe } from 'ramda'
import { parse } from 'url'
import { Quad } from 'n3'
import { trimCh } from '../tools'

/**
 * Estrapola l'identificativo dall'URI di un elemento
 * @param uri URL dell'elemento
 */
export const getID: (uri: string) => string | undefined = uri => {
  let urld = parse(uri).path
  let get = pipe(trimCh('/'), split(/\/|#/), last)
  return urld ? get(uri) : undefined
}

/**
 * Controlla la presenza di una Regex all'interno di una tripla
 */
export const checkQuad = curry((fil: string, quad: Quad) => {
  const regex = new RegExp(fil, 'gi')
  return Boolean(
    quad?.object?.value?.match(regex) ||
      quad?.predicate?.value?.match(regex) ||
      quad?.subject?.value?.match(regex)
  )
})

const encodeCharacter = (char: string): string =>
  '%' + char.charCodeAt(0).toString(16)
export const fixedEncodeURIComponent = (str: string): string =>
  encodeURIComponent(str).replace(/[!'()*]/g, encodeCharacter)

/**
 * Formatta un'oggetto trasformandolo un una stringa per URL
 * @param {{}} x Oggetto con i parametri della URI
 * @returns {string} i parametri convertiti in query
 */
export const formUrlEncoded = (x: {}): string =>
  Object.keys(x).reduce((p, c) => p + `&${c}=${encodeURIComponent(x[c])}`, '')
