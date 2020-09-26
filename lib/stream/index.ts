import { AjaxResponse } from 'rxjs/ajax'
import { from, MonoTypeOperatorFunction, Observable, of, pipe } from 'rxjs'
import { map, switchMap, filter, catchError, concatMap, reduce } from 'rxjs/operators'
import { path, hasPath, includes } from 'ramda'
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios'

import QuadFactory from '../lods/QuadFactory'
import { allCheck } from '../lods/changeUri'
import { Quad, DataFactory } from 'n3'
import { pingEndpoint } from '../tools'

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
    filter(checkContentType),
    map(path(['body'])),
    switchMap((data: unknown) =>
      QuadFactory.generateFromString(data as string, true)
    ),
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


export type LODDocument = {
  content: string,
  metadata: Record<string, string>,
  [key: string]: unknown
}

export const formatDocument = (uri: string) => {
  const seek: LODDocument = {
    content: '',
    metadata: {},
    uri
  }

  const isContent = (predicate: string) => ['comment', 'content', 'description'].some(pk => includes(pk, predicate))

  return fetchSPARQL(uri).pipe(
    reduce((document: LODDocument, quad: Quad) => {
      const predicate = quad.predicate.value
      if (isContent(predicate)) {
        document.content = document.content + quad.object.value
      } else {
        document.metadata[predicate] = quad.object.value
      }
      return document
    }, seek)
  )
}

