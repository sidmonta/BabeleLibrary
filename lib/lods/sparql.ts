import FormData from 'form-data'
import { pipe, prop, path } from 'ramda'

/**
 * Formatta una query SPARQL per essere inviata con una POST ad un triplestore
 * @param {string} query query in SPARQL
 * @param {string} defaultGraph specifica il grafo su cui fare la query
 */
export function formatQuery(query: string, defaultGraph: string = '') {
  const form = new FormData()
  form.append('default-graph-uri', defaultGraph || '')
  form.append('query', query)
  form.append('format', 'application/sparql-results+json')

  return form
}

/**
 * Tipico valore di un Nodo di una tripla
 * @var {'uri' | 'literal' | 'BlankNode'} type tipologia di nodo
 * @var {string} value valore del nodo
 */
export type ResultValue = {
  type: 'uri' | 'literal' | 'BlankNode'
  value: string
}

/**
 * Tipo di ritorno da un endpoint
 */
export interface EndpointResult {
  /**
   * Soggetto della tripla
   */
  subject: ResultValue
  /**
   * Predicato della tripla
   */
  predicate: ResultValue
  /**
   * Oggetto della tripla
   */
  object: ResultValue
  /**
   * Un parametro qualsiasi della select della query
   */
  [random: string]: ResultValue
}

/**
 * Estrapola da una risposta ad un endpoint i risultati trovati
 * @param a Risposta del server
 * @returns {EndpointResult[] | undefined} Lista di risposte del server
 */
export const getResults: (a: any) => EndpointResult[] | undefined = pipe(
  prop('body'),
  path(['results', 'bindings'])
)
