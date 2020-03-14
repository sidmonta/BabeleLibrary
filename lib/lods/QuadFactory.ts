import N3, { Quad, NamedNode } from 'n3'
import { createReadStream } from 'fs'
import { Observable, from } from 'rxjs'
import { map, mergeMap } from 'rxjs/operators'
import { RdfXmlParser } from 'rdfxml-streaming-parser'

import { fromStream } from '../stream'
import RDFConverter from './RDFConverter'
import { validURL } from '../tools'

const { namedNode, literal, quad, blankNode } = N3.DataFactory

export default class QuadFactory {
  /**
   * Trasforma un file di triple in uno Observable di Quad
   * @param {string} filename file da convertire
   * @returns {Observable<Quad>} Observable di Quad
   */
  public static generateFromFile(filename: string): Observable<Quad> {
    const rdfStream = createReadStream(filename)
    const streamParser =
      filename.endsWith('.rdf') || filename.endsWith('.xml')
        ? new RdfXmlParser()
        : new N3.StreamParser()

    rdfStream.pipe(streamParser)
    return fromStream(rdfStream)
  }

  /**
   * Trasforma una stringa in un Onservable di Quad
   * @param {string} text testo da convertire
   * @param {boolean} rdf se il testo è in formato RDF, Default false
   * @returns {Observable<Quad>} Observable di Quad
   */
  public static generateFromString(
    text: string,
    rdf: boolean = false
  ): Observable<Quad> {
    if (rdf) {
      const parser = new RdfXmlParser()
      try {
        parser.write(text)
        parser.end()

        return fromStream(parser)
      } catch (e) {
        return from(RDFConverter.convertFrom(text, 'xml', 'n3')).pipe(
          mergeMap((tt: string) => {
            const parser = new N3.Parser()
            const res = parser.parse(tt)

            return from(res)
          })
        )
      }
    } else {
      const parser = new N3.Parser()
      const res = parser.parse(text)

      return from(res)
    }
  }

  /**
   * Prende un array di array e lo trasforma in un Observable<Quad>.
   * L'array e formato:
   * ```
   * [
   *  [subject, predicate, object],
   *  ...
   * ]
   * ```
   * @param {Array<Array<string>>} quads Triple da trasformare
   * @returns {Observable<Quad>} Observable di Quad
   */
  public static generateFromArray(
    quads: Array<Array<string>>
  ): Observable<Quad> {
    return from(quads).pipe(
      map((q: Array<string>) => {
        const [subject, predicate, object] = q.map(el =>
          validURL(el) ? namedNode(el) : literal(el)
        )

        return quad(subject as NamedNode, predicate as NamedNode, object)
      })
    )
  }

  /**
   * Prende un array di oggetti e lo trasforma in un Observable<Quad>.
   * L'array e formato:
   * ```
   * [
   *  { s: string, p: string, o: string },
   *  ...
   * ]
   * ```
   * @param {Array<{s: string, p: string, o: string}>} quads Triple da trasformare
   * @returns {Observable<Quad>} Observable di Quad
   */
  public static generateFromObject(
    quads: Array<{ s: string; p: string; o: string }>
  ): Observable<Quad> {
    return from(quads).pipe(
      map((q: { s: string; p: string; o: string }) =>
        quad(
          namedNode(q.s),
          namedNode(q.p),
          validURL(q.o) ? namedNode(q.o) : literal(q.o)
        )
      )
    )
  }
}
