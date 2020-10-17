import parser, { X2jOptions } from 'fast-xml-parser'
import {
  forEachObjIndexed,
  fromPairs, head, ifElse,
  is,
  isNil, keys,
  lensPath,
  mapObjIndexed, not,
  pipe, values,
  view, isEmpty
} from 'ramda'
import * as N3 from 'n3'
import { DataFactory } from 'n3'
import quad = DataFactory.quad
import literal = DataFactory.literal
import namedNode = DataFactory.namedNode
import blankNode = DataFactory.blankNode

type Namespaces = Record<string, string>

type Node = {
  [key in string | number]: any
}

const ATTR_NODE_NAME = 'attr'
const TEXT_NODE_NAME = '#text'

/**
 * Verifico se è un oggetto non vuoto
 * @param a
 */
const isObject = (a: Node | string) => typeof a === 'object' && !isEmpty(a)

// Definizione delle opzioni per il parsing del XML
const options: Partial<X2jOptions> = {
  attributeNamePrefix: '',
  attrNodeName: ATTR_NODE_NAME, //default is 'false'
  textNodeName: TEXT_NODE_NAME,
  ignoreAttributes: false,
  ignoreNameSpace: false,
  allowBooleanAttributes: false,
  parseNodeValue: true,
  parseAttributeValue: false,
  trimValues: true,
  parseTrueNumberOnly: false,
  arrayMode: false, //"strict"
}

/* Definizione delle lenti per l'accesso alle proprietà di un Nodo XML */
const namespaceLens = lensPath(['rdf:RDF', ATTR_NODE_NAME]) // Accede ai namespace
const aboutLens = lensPath([ATTR_NODE_NAME, 'rdf:about']) // Accede all'attributo about
const resourceLens = lensPath([ATTR_NODE_NAME, 'rdf:resource']) // Accede all'attributo resource
const langLens = lensPath([ATTR_NODE_NAME, 'xml:lang']) // Accede all'attributo lingua

/* Definizioni di getter e check su proprietà dei nodi XML */
// Un nodo XML contiene un soggetto
const getSubject: (node: Node) => string = view(aboutLens) || ''
const haveSubject: (node: Node) => boolean = node => pipe(getSubject, isNil, not)(node) || keys(node)[0] === 'rdf:Description'

// Un nodo xml contiene un oggetto
const getResource: (node: Node) => string = view(resourceLens) || ''
const haveResource: (node: Node) => boolean = pipe(getResource, isNil, not)

// In un nodo xml è definita la lingua
const getLang: (node: Node) => string = view(langLens)
const haveLang: (node: Node) => boolean = pipe(getLang, isNil, not)

/* Genera Nodi in formato N3 a partire dai valori */
const generatePredicate: (value: string) => N3.Quad_Predicate = namedNode
const generateSubject: (subject: string) => N3.Quad_Subject = (subject) => subject ? namedNode(subject) : blankNode()
// Di seguito il generatore per l'oggetto che utilizza funzioni di utilità per capire come deve essere definito
// l'oggetto. L'oggetto RDF può essere un literal, un namedNode
const termFromResource: (node: Node) => N3.NamedNode = pipe(getResource, namedNode)
const termFromSubject: (node: Node) => N3.Quad_Subject = pipe(getSubject, generateSubject)
const termWithLanguage: (node: Node) => N3.Literal = node => literal(node[TEXT_NODE_NAME], getLang(node))
const termFromBasicString: (node: string) => N3.Literal = literal

/*
* Permette di estrarre un oggetto da un oggetto padre.
* Praticamente un oggetto di una tripla può essere la definizione di un'altra risorsa LOD
* definita nello stesso modo in cui viene definito il soggetto di una tripla
*/
const extractTermFromObject: (node: Node) => N3.Quad_Object = node => {
  const val = head(values(node))
  if (val) {
    return ifElse(haveSubject, termFromSubject, generateObject)(val)
  }
  return blankNode()
}

/**
 * Genera un oggetto a partire da un nodo XML
 * @param node
 */
const generateObject: (node: Node | string) => N3.Quad_Object = (node) => {
  // Gestione dei literal
  if (typeof node === 'string') return termFromBasicString(node)
  // Gestione dei namedNode
  if (haveResource(node)) return termFromResource(node)
  // Gestione dei literal con l'attributo lang
  if (haveLang(node)) return termWithLanguage(node)
  // Gestione di un sotto-oggetto come proprietà
  if (isObject(node)) return extractTermFromObject(node)
  // Altrimenti ritorna un nodo vuoto
  return blankNode()
}

/**
 * Permette di estrarre tutti i namespace definiti nell'XML
 * @param namespaceAttr Nodo xml contenente i namespace
 */
const extractNamespaces = (namespaceAttr: Namespaces): Namespaces => {
  return pipe(
    mapObjIndexed((value: string, key: string) => [key.replace('xmlns:', ''), value]),
    Object.values,
    fromPairs
  )(namespaceAttr) as Namespaces
}

/**
 * Aggiunge una tripla al writer per la scrittura conclusiva
 * @param writer
 */
const addQuad = (writer) => (newQuad: N3.Quad) => writer.addQuad(newQuad)

/**
 * Funzione di utilità per eseguire un foreach dei nodi XML
 * @param func
 */
const forEachObj = (func: (value: any, key: (string | number | symbol), obj?: any) => void) => {
  const cicle = forEachObjIndexed((value, key, obj) => {
    if (key !== ATTR_NODE_NAME) {
      func(value, key, obj)
    }
  })
  return (obj: Node) => cicle(obj)
}

/**
 * Funzione che esegue il parsing di una stringa XML contenente RDF in una stringa in formato N3
 * @param xmlstring stringa XML contenente RDF
 * @return stringa convertita in formato N3
 */
export default function parseRdfXML (xmlstring: string): Promise<string> {
  try {
    // Parsifico l'xml per trasformarlo in un oggetto
    const jsonObj = parser.parse(xmlstring, options)
    // Estrapolo i namespaces definiti nell'XML
    const namespaces = extractNamespaces(view(namespaceLens, jsonObj))
    // Definisco un writer dove verranno salvate tutte le triple che poi genererà la stringa in formato RDF
    const writer = new N3.Writer({ prefixes: namespaces })
    // Definisco la funzione che permetterà di salvare le triple all'interno del writer
    const add = addQuad(writer)
    //Ciclo per ogni nodo xml
    forEachObj((value, key) => {
      // Se è un oggetto procedo, altrimenti non è un XML per un RDF
      if (is(Object, value)) {
        // Recupero il soggetto definito nel nodo che si sta analizzando
        const subject: N3.Quad_Subject = termFromSubject(value)
        // Parsifico il contenuto del nodo a cui fa capo il soggetto appena estratto
        parse(add, subject, value)
        // Gestisco il caso in cui nel tag del soggetto sia definito alnche la tipologia del soggetto.
        if (typeof key === 'string' && key !== 'rdf:Description') {
          const predicate = namedNode('rdf:type')
          const object = namedNode(key)

          add(quad(subject, predicate, object))
        }
      }
    })(jsonObj['rdf:RDF'])
    // Finisco con il generare la stringa convertita tramite il writer e ritornarla
    return new Promise((resolve, reject) => {
      writer.end((error, result) => {
        if (error) { reject(error) }
        resolve(result)
      })
    })
  } catch (error) {
    console.log(error)
  }
  return Promise.resolve('')
}

/**
 * Funzione che parsifica il nodo di un soggetto RDF
 * @param add funzione per aggiungere una tripla al writer
 * @param subject soggetto della tripla
 * @param node nodo da parsificare
 */
function parse (add, subject, node: Node): void {
  // Per ogni sotto-nodo del nodo
  forEachObj((value, key) => {
    // Esiste la possibilità che per ogni predicato ci siano più oggetti, quindi gestico il tutto con un array
    const objectsSource: Array<Node | string> = Array.isArray(value) ? value : [value]
    // Genero gli oggetti associati alla tripla
    const object = objectsSource.map(generateObject)

    // Recupero la definizione del predicato dal nodo
    if (typeof key === 'string' && isNaN(parseInt(key))) {
      const predicate = generatePredicate(key)
      // Con il soggetto, il predicato e i vari oggetti inserisco tutti all'interno del writer
      object.forEach((obj) => add(quad(subject, predicate, obj)))
    }
    // Se il sotto-nodo a al suo interno altri sotto-nodi in cui è definito anche un soggetto
    // parsifico questi sotto-sotto-nodi
    if (isObject(value) && haveSubject(value)) {
      parse(add, termFromSubject(value), value)
    }
  })(node)
}
