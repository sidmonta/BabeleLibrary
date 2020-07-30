import { includes, ifElse, identity, pipe, match, head, concat, is } from 'ramda'
import { NonEmptyArray } from '../tools'

type URI = string

export type control = (is?: string, change?: (uri: URI) => URI) => string | control

export const createCheck = (is: string, change: (uri: URI) => URI) => ifElse(includes(is), change, identity)

// Wikidata
export const checkWikidata: (uri: URI) => string = createCheck('wikidata', pipe(
  match(/[QP][0-9]+$/), // Controllo che l'url finisca con l'identificativo solito di wikidata
  head, // Recupero l'identificativo
  ifElse(is(String), identity, _ => ''), // Se non ho trovato nessun identificativo lo setto di default a ''
  concat('http://www.wikidata.org/wiki/Special:EntityData/') // Concateno l'identificativo all'url di wikidata
))
// VIAF
export const checkViaf: (uri: URI) => string = createCheck('viaf', (uri: URI) => uri + '/rdf.xml')

// OpenLibrary
export const checkOpenLibrary: (uri: URI) => string = createCheck('openlibrary', (uri: URI) => uri + '.rdf')

export const allCheck = pipe(checkWikidata, checkViaf, checkOpenLibrary)

function baseChangeURI() {
  let aggregate: NonEmptyArray<(uri: URI) => URI> = [checkWikidata, checkViaf]
  const control: control = (is?: string, change?: (uri: URI) => URI) => {
    if (is && change) {
      aggregate.push(createCheck(is, change))
      return control
    } else if (is) {
      // @ts-ignore
      return pipe(...aggregate)(is)
    }
    // @ts-ignore
    return pipe(...aggregate)
  }
  return control
}

export const changeUri: control = baseChangeURI()
