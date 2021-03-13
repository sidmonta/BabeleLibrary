import * as N3 from 'n3'
import { createReadStream } from 'fs'
import { Observable, from } from 'rxjs'
import { map, mergeMap } from 'rxjs/operators'
import { RdfXmlParser } from 'rdfxml-streaming-parser'

import { fromStream } from '../stream'
import RDFConverter from './RDFConverter'
import { validURL } from '../tools'
import parseRdfXML from './RdfXMLParser'
import { tryCatch } from 'ramda'

/**
 * Alias
 */
type Quad = N3.Quad
type NamedNode = N3.NamedNode

// Iniziallizzazione del parser N3 globale (non serve inizializzarlo ad ogni utilizzo)
const parser = new N3.Parser()

//const { namedNode, literal, quad } = N3.DataFactory

/**
 * Effettua un parse da una stringa in formato N3 in array di triple, transformandole poi in stream
 * @param text stringa di testo contenente Turtle da convertire
 */
const parse = (text: string): Observable<Quad> => {
  const res = parser.parse(text) as N3.Quad[]
  return from(res)
}
/**
 * Provo per prima cosa a convertire RDF in N3 con un metodo veloce, se qualcosa va storto provo con i tool online
 */
const convertXmlWthFallback: (xml: string) => Promise<string> = tryCatch(parseRdfXML, (t: string) => RDFConverter.convertFrom(t, 'xml', 'n3'))

/**
 * @class
 * Classe statica che definisce diversi metodi per la generazione di Triple a partire da vari formati
 */
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
   * Trasforma una stringa in un Observable di Quad
   * @param {string} text testo da convertire
   * @param {boolean} rdf se il testo è in formato RDF, Default false
   * @returns {Observable<Quad>} Observable di Quad
   */
  public static generateFromString(
    text: string,
    rdf: boolean = false
  ): Observable<Quad> {
    if (rdf) { // Se la stringa è in formato RDF allora va convertita in formato N3
      // Effettuo la conversione da XML a N3
      const toParse: Promise<string> = convertXmlWthFallback(text)
      // Dal testo parsificato poi eseguo il parse per ottenere lo stream di triple
      return from(toParse).pipe(mergeMap(parse))
    } else {
      // Se è già in formato n3 eseguo direttamente il parse
      return parse(text)
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
          validURL(el) ? N3.DataFactory.namedNode(el) : N3.DataFactory.literal(el)
        )

        return N3.DataFactory.quad(subject as NamedNode, predicate as NamedNode, object)
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
        N3.DataFactory.quad(
          N3.DataFactory.namedNode(q.s),
          N3.DataFactory.namedNode(q.p),
          validURL(q.o) ? N3.DataFactory.namedNode(q.o) : N3.DataFactory.literal(q.o)
        )
      )
    )
  }
}
