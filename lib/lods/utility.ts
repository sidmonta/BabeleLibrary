import { curry, last, split, pipe, hasPath } from 'ramda'
import { parse } from 'url'
import { Quad } from 'n3'
import { trimCh } from '../tools'
import axios from 'axios'
import { allCheck } from './changeUri'

/**
 * Estrapola l'identificativo dall'URI di un elemento
 * @param uri URL dell'elemento
 */
export const getID: (uri: string) => string | undefined = uri => {
  let urld = parse(uri).path
  let get = pipe(trimCh('/'), split(/[\/#]/), last)
  return urld ? get(uri) as string : undefined
}

/**
 * Controlla la presenza di una Regex all'interno di una tripla
 */
export const checkQuad = curry((fil: string, quad: Quad): boolean => {
  const regex = new RegExp(fil, 'gi')
  return Boolean(
    quad?.object?.value?.match(regex) ||
    quad?.predicate?.value?.match(regex) ||
    quad?.subject?.value?.match(regex)
  )
})

const encodeCharacter = (char: string): string =>
  '%' + char.charCodeAt(0).toString(16)
/**
 * Custom encodeURIComponent
 * @param str
 */
export const fixedEncodeURIComponent = (str: string): string =>
  encodeURIComponent(str).replace(/[!'()*]/g, encodeCharacter)

/**
 * Formatta un'oggetto trasformandolo un una stringa per URL
 * @param {{}} x Oggetto con i parametri della URI
 * @returns {string} i parametri convertiti in query
 */
export const formUrlEncoded = (x: {}): string =>
  Object.keys(x).reduce((p, c) => p + `&${c}=${encodeURIComponent(x[c])}`, '')

/**
 * Verifica se l'URI passata come parametro è una risorsa LOD.
 * Il controllo avviene controllando il content-type della risposta alla chiamata alla risorsa. Si è utilizzato il
 * metodo HEAD per risparmiare banda e tempo nella risposta visto che del contenuto non occorre
 * @param uri URI da cui controllare
 * @return se l'uri identifica una risorsa LOD
 */
export const isLodURI: (uri: string) => Promise<boolean> = async (uri: string) => {
  return axios.head(allCheck(uri), {
    headers: {
      Accept: 'application/rdf+xml'
    }
  }).then(response => {
    return Boolean(
      hasPath(['headers', 'content-type'], response) &&
      (
        response.headers['content-type'].includes('xml') ||
        response.headers['content-type'].includes('rdf')
      )
    )
  })
}
