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

async function a() {
  parseRdfXML(`
  <?xml version="1.0" encoding="utf-8"?>
<rdf:RDF
  xmlns:rdf='http://www.w3.org/1999/02/22-rdf-syntax-ns#'
  xmlns:rdfs='http://www.w3.org/2000/01/rdf-schema#'
  xmlns:rdrel='http://RDVocab.info/RDARelationshipsWEMI/'
  xmlns:dcterms='http://purl.org/dc/terms/'
  xmlns:dcam='http://purl.org/dc/dcam/'
  xmlns:ov='http://open.vocab.org/terms/'
  xmlns:frbr='http://purl.org/vocab/frbr/core#'
  xmlns:foaf='http://xmlns.com/foaf/0.1/'
>



    <frbr:Work rdf:about="https://openlibrary.org/works/OL3298870W">
            <dcterms:title>A new religious America</dcterms:title>



      <dcterms:creator>
          <rdf:Description rdf:about="https://openlibrary.org/authors/OL539752A">
              <foaf:name>Diana L. Eck</foaf:name>
          </rdf:Description>
      </dcterms:creator>

          <dcterms:subject>Religion</dcterms:subject>
    <dcterms:subject>History</dcterms:subject>
    <dcterms:subject>Nonfiction</dcterms:subject>
    <dcterms:subject>Religion &amp; Spirituality</dcterms:subject>
    <dcterms:subject>Religión</dcterms:subject>

          <dcterms:coverage>United States</dcterms:coverage>


          <dcterms:description>Why Understanding America&#39;s Religious Landscape Is the Most Important Challenge Facing Us TodayThe 1990s saw the U.S. Navy commission its first Muslim chaplain and open its first mosque.There are presently more than three hundred temples in Los Angeles, home to the greatest variety of Buddhists in the world.There are more American Muslims than there are American Episcopalians, Jews, or Presbyterians.</dcterms:description>



      <dcterms:subject>
          <rdf:Description>
              <dcam:memberOf rdf:resource="http://purl.org/dc/terms/DDC"/>
              <rdf:value>200/.92</rdf:value>
          </rdf:Description>
      </dcterms:subject>
      <dcterms:subject>
          <rdf:Description>
              <dcam:memberOf rdf:resource="http://purl.org/dc/terms/LCC"/>
              <rdf:value>BL2525 .E35 2001</rdf:value>
          </rdf:Description>
      </dcterms:subject>

          <dcterms:date>2001</dcterms:date>





    </frbr:Work>

    <rdf:Description rdf:about="https://openlibrary.org/books/OL23245423M">
        <rdrel:workManifested rdf:resource="https://openlibrary.org/works/OL3298870W" />
        <dcterms:title>A new religious America: how a &quot;Christian country&quot; has now become the world&#39;s most religiously diverse nation</dcterms:title>
        <dcterms:date>2001</dcterms:date>
    </rdf:Description>


    <rdf:Description rdf:about="https://openlibrary.org/books/OL24281018M">
        <rdrel:workManifested rdf:resource="https://openlibrary.org/works/OL3298870W" />
        <dcterms:title>A New Religious America</dcterms:title>
        <dcterms:date>2007</dcterms:date>
    </rdf:Description>

    <rdf:Description rdf:about="https://openlibrary.org/books/OL3940639M">
        <rdrel:workManifested rdf:resource="https://openlibrary.org/works/OL3298870W" />
        <dcterms:title>A new religious America: how a &quot;Christian country&quot; has now become the world&#39;s most religiously diverse nation</dcterms:title>
        <dcterms:date>2001</dcterms:date>
    </rdf:Description>

    <rdf:Description rdf:about="https://openlibrary.org/books/OL9234492M">
        <rdrel:workManifested rdf:resource="https://openlibrary.org/works/OL3298870W" />
        <dcterms:title>A New Religious America: How a &quot;Christian Country&quot; Has Become the World&#39;s Most Religiously Diverse Nation</dcterms:title>
        <dcterms:date>May 28, 2002</dcterms:date>
    </rdf:Description>

    <rdf:Description rdf:about="https://openlibrary.org/books/OL22135397M">
        <rdrel:workManifested rdf:resource="https://openlibrary.org/works/OL3298870W" />
        <dcterms:title>A new religious America: how a &quot;Christian country&quot; has become the world&#39;s most religiously diverse nation</dcterms:title>
        <dcterms:date>2001</dcterms:date>
    </rdf:Description>

    <rdf:Description rdf:about="https://openlibrary.org/books/OL7279785M">
        <rdrel:workManifested rdf:resource="https://openlibrary.org/works/OL3298870W" />
        <dcterms:title>A New Religious America: How a &quot;Christian Country&quot; Has Become the World&#39;s Most Religiously Diverse Nation</dcterms:title>
        <dcterms:date>May 28, 2002</dcterms:date>
    </rdf:Description>

    <!-- administrative -->
    <rdf:Description rdf:about="">
        <dcterms:modified rdf:datatype="http://www.w3.org/2001/XMLSchema#dateTime">2020-07-27T03:53:46.226425</dcterms:modified>
        <dcterms:created rdf:datatype="http://www.w3.org/2001/XMLSchema#dateTime">2009-12-10T03:17:40.564205</dcterms:created>
        <ov:versionnumber>7</ov:versionnumber>
    </rdf:Description>

</rdf:RDF>
`)


  const parser = new N3.Parser()
  const res = parser.parse(`@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>.
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>.
@prefix rdrel: <http://RDVocab.info/RDARelationshipsWEMI/>.
@prefix dcterms: <http://purl.org/dc/terms/>.
@prefix dcam: <http://purl.org/dc/dcam/>.
@prefix ov: <http://open.vocab.org/terms/>.
@prefix frbr: <http://purl.org/vocab/frbr/core#>.
@prefix foaf: <http://xmlns.com/foaf/0.1/>.

<https://openlibrary.org/works/OL15625461W> dcterms:title "The world&#39;s religions";
    dcterms:creator <https://openlibrary.org/authors/OL581375A>.
_:n3-127 rdf:Description "https://openlibrary.org/authors/OL581375A".
<https://openlibrary.org/authors/OL581375A> foaf:name "Young, William A.".
<https://openlibrary.org/works/OL15625461W> dcterms:subject "Religions", "Cults", "Sects", "Religion";
    rdf:type frbr:Work.
<https://openlibrary.org/books/OL24573664M> rdrel:workManifested <https://openlibrary.org/works/OL15625461W>;
    dcterms:title "The world&#39;s religions: worldviews and contemporary issues";
    dcterms:date _:n3-129.
_:n3-131 dcterms:modified "2017-12-06T05:11:11.167241";
    dcterms:created "2011-01-06T19:37:56.771302";
    ov:versionnumber _:n3-132.`)
  console.log(res)
}

a()
