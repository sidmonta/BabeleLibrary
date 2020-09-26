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

type Namespaces = {
  [key: string]: string
}

type Node = {
  [key in string | number]: any
}

const ATTR_NODE_NAME = 'attr'
const TEXT_NODE_NAME = '#text'

const isObject = (a: Node | string) => typeof a === 'object' && !isEmpty(a)

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

const namespaceLens = lensPath(['rdf:RDF', ATTR_NODE_NAME])
const aboutLens = lensPath([ATTR_NODE_NAME, 'rdf:about'])
const resourceLens = lensPath([ATTR_NODE_NAME, 'rdf:resource'])
const langLens = lensPath([ATTR_NODE_NAME, 'xml:lang'])

const getSubject: (node: Node) => string = view(aboutLens) || ''
const haveSubject: (node: Node) => boolean = node => pipe(getSubject, isNil, not)(node) || keys(node)[0] === 'rdf:Description'

const getResource: (node: Node) => string = view(resourceLens) || ''
const haveResource: (node: Node) => boolean = pipe(getResource, isNil, not)

const getLang: (node: Node) => string = view(langLens)
const haveLang: (node: Node) => boolean = pipe(getLang, isNil, not)

const generatePredicate: (value: string) => N3.Quad_Predicate = namedNode
const generateSubject: (subject: string) => N3.Quad_Subject = (subject) => subject ? namedNode(subject) : blankNode()

const termFromResource: (node: Node) => N3.NamedNode = pipe(getResource, namedNode)
const termFromSubject: (node: Node) => N3.Quad_Subject = pipe(getSubject, generateSubject)
const termWithLanguage: (node: Node) => N3.Literal = node => literal(node[TEXT_NODE_NAME], getLang(node))
const termFromBasicString: (node: string) => N3.Literal = literal

const extractTermFromObject: (node: Node) => N3.Quad_Object = node => {
  const val = head(values(node))
  if (val) {
    return ifElse(haveSubject, termFromSubject, generateObject)(val)
  }
  return blankNode()
}

const generateObject: (node: Node | string) => N3.Quad_Object = (node) => {

  if (typeof node === 'string') return termFromBasicString(node)
  if (haveResource(node)) return termFromResource(node)
  if (haveLang(node)) return termWithLanguage(node)
  if (isObject(node)) return extractTermFromObject(node)

  return blankNode()
}

const extractNamespaces = (namespaceAttr: Namespaces): Namespaces => {
  return pipe(
    mapObjIndexed((value: string, key: string) => [key.replace('xmlns:', ''), value]),
    Object.values,
    fromPairs
  )(namespaceAttr) as Namespaces
}

const addQuad = (writer) => (newQuad: N3.Quad) => writer.addQuad(newQuad)

const forEachObj = (func: (value: any, key: (string | number | symbol), obj?: any) => void) => {
  const cicle = forEachObjIndexed((value, key, obj) => {
    if (key !== ATTR_NODE_NAME) {
      func(value, key, obj)
    }
  })
  return (obj: Node) => cicle(obj)
}

export default function parseRdfXML (xmlstring: string): Promise<string> {
  try {
    const jsonObj = parser.parse(xmlstring, options)
    const namespaces = extractNamespaces(view(namespaceLens, jsonObj))
    const writer = new N3.Writer({ prefixes: namespaces })
    const add = addQuad(writer)
    forEachObj((value, key) => {
      if (is(Object, value)) {
        const subject: N3.Quad_Subject = termFromSubject(value)
        parse(add, subject, value)
        if (typeof key === 'string' && key !== 'rdf:Description') {
          const predicate = namedNode('rdf:type')
          const object = namedNode(key)

          add(quad(subject, predicate, object))
        }
      }
    })(jsonObj['rdf:RDF'])
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

function parse (add, subject, node: Node): void {
  forEachObj((value, key) => {
    const objectsSource: Array<Node | string> = Array.isArray(value) ? value : [value]
    const object = objectsSource.map(generateObject)

    if (typeof key === 'string' && isNaN(parseInt(key))) {
      const predicate = generatePredicate(key)
      object.forEach((obj) => add(quad(subject, predicate, obj)))
    }

    if (isObject(value) && haveSubject(value)) {
      parse(add, termFromSubject(value), value)
    }
  })(node)
}
