import { includes, ifElse, identity, pipe, match, head, concat } from 'ramda'
import { NonEmptyArray } from '../tools'

type URI = string

export type control = (is?: string, change?: (uri: URI) => URI) => string | control

export const createCheck = (is: string, change: (uri: URI) => URI) => ifElse(includes(is), change, identity)

// Wikidata
export const checkWikidata: (uri: URI) => string = createCheck('wikidata', pipe(
  match(/[QP][0-9]+$/),
  head,
  concat('https://www.wikidata.org/wiki/Special:EntityData/')
))
// VIAF
export const checkViaf: (uri: URI) => string = createCheck('viaf', (uri: URI) => uri + '/rdf.xml')

export const allCheck = pipe(checkWikidata, checkViaf)

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
