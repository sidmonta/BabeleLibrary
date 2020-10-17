import { includes, ifElse, identity, pipe, match, head, concat, is } from 'ramda'
import { NonEmptyArray } from '../tools'

/**
 * Alias URI
 */
type URI = string

type ChangeFn = (uri: URI) => URI

/**
 * Tipologia che definisce come deve essere una funzione per la modifica dell'URI
 */
export type control = (is?: string, change?: ChangeFn) => string | control

/**
 * Funzione di utilità che wrappa i passaggi per la variazione dell'URI
 * @param is valore che l'uri deve contenere per poter essere modificato
 * @param change Funzione che modifica l'URI
 */
export const createCheck = (is: string, change: ChangeFn): ChangeFn  => ifElse(includes(is), change, identity)

// Wikidata
export const checkWikidata: ChangeFn = createCheck('wikidata', pipe(
  match(/[QP][0-9]+$/), // Controllo che l'url finisca con l'identificativo solito di wikidata
  head, // Recupero l'identificativo
  ifElse(is(String), identity, _ => ''), // Se non ho trovato nessun identificativo lo setto di default a ''
  concat('http://www.wikidata.org/wiki/Special:EntityData/') // Concateno l'identificativo all'url di wikidata
))
// VIAF
export const checkViaf: ChangeFn = createCheck('viaf', (uri: URI) => uri + '/rdf.xml')

// OpenLibrary
export const checkOpenLibrary: ChangeFn = createCheck('openlibrary', (uri: URI) => uri + '.rdf')

// Aggraga tutti i modificatori di URI
export const allCheck = pipe(checkWikidata, checkViaf, checkOpenLibrary)


function baseChangeURI() {
  // Aggiunta dei modificatori di base
  // TODO: Implementare meccanismo per il recupero da un database di questi modificatori
  let aggregate: NonEmptyArray<ChangeFn> = [checkWikidata, checkViaf, checkOpenLibrary]
  // Creazione di una funzione per l'aggregazione o l'esecuzione delle modifiche all'URI
  const control: control = (is?: string, change?: ChangeFn) => {
    // Se ho definito sia il criterio che la funzione di modifica, aggiungo il nuovo criterio nell'aggregatore
    if (is && change) {
      aggregate.push(createCheck(is, change))
      return control
    } else if (is) { // Se ho passato solo il criterio allora eseguo i controlli usando il criterio come URI
      // @ts-ignore
      return pipe(...aggregate)(is)
    }
    // Altrimenti ritorno una funzione che eseguirà tutti i criteri quando gli verrà passato una URI
    // @ts-ignore
    return pipe(...aggregate)
  }
  return control
}

/**
 * Funzione che permette l'aggregazione di più metodi di modifica dell'uri o l'esecuzione vera e propria
 */
export const changeUri: control = baseChangeURI()
