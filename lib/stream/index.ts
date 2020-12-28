import { AjaxResponse } from 'rxjs/ajax'
import { from, MonoTypeOperatorFunction, Observable, of, pipe } from 'rxjs'
import { map, switchMap, filter, catchError, concatMap, reduce } from 'rxjs/operators'
import { path, hasPath, includes, isEmpty } from 'ramda'
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios'
import QuadFactory from '../lods/QuadFactory'
import { allCheck } from '../lods/changeUri'
import { Quad, DataFactory } from 'n3'
import { pingEndpoint } from '../tools'
import { getID } from '../lods'

/**
 * Tipo di ritorno di una richiesta fetch
 */
export interface FetchResponse {
  response: AxiosResponse,
  body: any,
  params: any
}

/**
 * Trasforma uno stream di dati in un Observable
 * @param stream streaming da convertire
 * @param finishEventName nome del metodo dello stream per segnalare la fine dello stream. Di default 'end'
 * @param dataEventName nome del metodo dello stream per l'arrivo di nuovi dati. Di default 'data'
 * @returns {Observable<any>} Observable dello stream
 */
export function fromStream (
  stream: any,
  finishEventName = 'end',
  dataEventName = 'data'
): Observable<any> {
  stream.pause()

  return new Observable(observer => {
    function dataHandler (data: any) {
      observer.next(data)
    }

    function errorHandler (err: any) {
      observer.error(err)
    }

    function endHandler () {
      observer.complete()
    }

    stream.addListener(dataEventName, dataHandler)
    stream.addListener('error', errorHandler)
    stream.addListener(finishEventName, endHandler)

    stream.resume()

    return () => {
      stream.removeListener(dataEventName, dataHandler)
      stream.removeListener('error', errorHandler)
      stream.removeListener(finishEventName, endHandler)
    }
  })
}

/**
 * Effettua una chiamata fetch con axios il cui risultato è trasformato in stream
 * @param url Configurazione per eseguire la chiamata con axios
 * @param params configurazione aggiuntiva che viene appesa alla risposta.
 */
export function fetchContent ({ url, params }: {
  url: AxiosRequestConfig,
  params?: unknown
}): Observable<FetchResponse> {
  return new Observable((observer) => {
    axios(url)
      .then((response: AxiosResponse) => {
        observer.next({
          response: response, body: response.data, params
        })
        observer.complete()
      })
      .catch(err => { observer.error(err) })
  })
}

/**
 * Verifica se il ContentType di una risposta sia in formato xml/rdf
 * @param data Risposta di una chiamata fetch
 */
const checkContentType = (data: FetchResponse) =>
  Boolean(
    hasPath(['response', 'headers', 'content-type'], data) &&
    (data.response.headers['content-type'].includes('xml') ||
      data.response.headers['content-type'].includes('rdf'))
  )

/**
 * Esegue una chiamata fetch. Specifico per gli endpoint SPARQL, restituisce un RDF
 * @param {string} url uri del record da cui ottenere l'RDF
 * @returns {Observable<Quad>} Observable di quad
 */
export function fetchSPARQL (url: string): Observable<Quad> {
  return fetchContent({
    url: {
      url: allCheck(url),
      method: 'GET',
      headers: {
        Accept: 'application/rdf+xml'
      }
    }
  }).pipe(
    filter(checkContentType), // Filtra solo la chiamata con il corretto ContentType
    map(path(['body'])), // Estrapola il body della risposta
    switchMap((data: unknown) =>
      QuadFactory.generateFromString(data as string, true) // Genera le triple a partire dalla risposta
    ),
    // Se c'è un errore genera una tripla vuota
    catchError((_: AjaxResponse) => of(DataFactory.quad(
      DataFactory.blankNode(),
      DataFactory.variable(''),
      DataFactory.literal('')
    )))
  )
}

/**
 * Implementa un operatore per Rxjs che esegue un filtro asyncrono sui dati che arrivano dallo stream
 * @param predicate funzione che funge da predicato per la valutazione del dato
 */
export function asyncFilter<T> (predicate: (value: T, index: number) => Promise<boolean>): MonoTypeOperatorFunction<T> {
  let inx = 0
  return pipe(
    concatMap((data: T) => from(predicate(data, inx++)).pipe(map((valid: boolean) => ({ valid, data })))),
    filter(({ valid }) => valid),
    map(({ data }) => data)
  )
}

/**
 * Operatore Rxjs che ritorna solo gli endpoint che sono accessibili
 */
export const filterByPing = () => asyncFilter(pingEndpoint)

// Definisce un "Documento" LOD
export type LODDocument = {
  content: string, // Contenuto, cioè contiene i valori delle triple che definiscono la descrizione del documento
  metadata: Record<string, string>, // Insieme degli altre triple che definiscono il documento
  [key: string]: unknown // Altri valori
}

/**
 * Metodo che a partire da un URI definisce un LODDocument
 * @param uri della risorsa da formattare
 */
export const formatDocument = (uri: string) => {
  const seek: LODDocument = {
    content: '',
    metadata: {},
    uri
  }

  // Determina se una tripla fa parte del contenuto del documento o meno
  const isContent = (predicate: string) => ['comment', 'content', 'description'].some(pk => includes(pk, predicate))

  // Recupera le triple della risorsa
  return fetchSPARQL(uri).pipe(
    reduce((document: LODDocument, quad: Quad) => {
      const predicate = quad.predicate.value
      if (isContent(predicate)) {
        document.content = document.content + quad.object.value
      } else {
        let idx: string = getID(predicate) || predicate
        if (!isEmpty(idx)) {
          document.metadata[idx] = quad.object.value
        }
      }
      return document
    }, seek)
  )
}

