import { ajax, AjaxResponse } from 'rxjs/ajax'
import { of, Observable } from 'rxjs'
import { catchError, map, switchMap, filter } from 'rxjs/operators'
import { path, hasPath } from 'ramda'

import QuadFactory from '../lods/QuadFactory'

/**
 * Trasforma uno stream di dati in un Observable
 * @param stream streaming da convertire
 * @param finishEventName nome del metodo dello stream per segnalare la fine dello stream. Di default 'end'
 * @param dataEventName nome del metodo dello stream per l'arrivo di nuovi dati. Di default 'data'
 * @returns {Observable<any>} Observable dello stream
 */
export function fromStream(
  stream: any,
  finishEventName = 'end',
  dataEventName = 'data'
): Observable<any> {
  stream.pause()

  return new Observable(observer => {
    function dataHandler(data: any) {
      observer.next(data)
    }

    function errorHandler(err: any) {
      observer.error(err)
    }

    function endHandler() {
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

const checkContentType = (data: AjaxResponse) =>
  Boolean(
    hasPath(['response', 'headers', 'Content-Type'], data) &&
      (data.response.headers['Content-Type'].includes('xml') ||
        data.response.headers['Content-Type'].includes('rdf'))
  )

/**
 * Esegue una chiamata fetch. Specifico per gli endpoint SPARQL, restituisce un RDF
 * @param {string} uri uri del record da cui ottenere l'RDF
 * @returns {Observable<Quad>} Observable di quad
 */
export function fatchSPARQL(url: string) {
  return ajax({
    url,
    method: 'GET',
    headers: {
      Accept: 'application/rdf+xml'
    }
  }).pipe(
    filter(checkContentType),
    map(path(['response', 'data'])),
    switchMap(data => QuadFactory.generateFromString(data, true)),
    catchError((_: AjaxResponse) => of({ body: '' }))
  )
}
