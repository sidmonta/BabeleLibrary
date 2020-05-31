import { AjaxResponse } from 'rxjs/ajax'
import { Observable, of } from 'rxjs'
import { map, switchMap, filter, catchError } from 'rxjs/operators'
import { path, hasPath } from 'ramda'
import axios, { AxiosResponse } from 'axios'

import QuadFactory from '../lods/QuadFactory'
import { Quad, DataFactory } from 'n3'

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

export function fetchContent ({ url, params }: any): Observable<FetchResponse> {
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
export function fatchSPARQL (url: string): Observable<Quad> {
  return fetchContent({
    url: {
      url,
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
