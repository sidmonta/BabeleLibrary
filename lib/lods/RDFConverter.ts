import axios from 'axios'
import FormData from 'form-data'

type OutputFormat = 'rdfa' | 'microdata' | 'xml' | 'n3' | 'nt' | 'json-ld'
type InputFormat = OutputFormat

/**
 * Classe statica che utilizza il servizio <http://rdf-translator.appspot.com>
 * per la conversione in vari formati LOD di una stringa.
 * Se il servizio non fosse disponibile per qualche motivo, fa un secondo
 * tentativo sul servizio <http://www.easyrdf.org>
 *
 */
export default class RDFConverter {
  /**
   * Converte utilizzando il servizio rdf-translator
   * @param str stringa da convertire
   * @param source formato della stringa da convertire
   * @param target formato delle conversione
   * @private
   */
  private static rdfTranslator(str: string, source: string, target: string) {
    const url = `http://rdf-translator.appspot.com/convert/${source}/${target}/content`
    const form = new FormData()
    form.append('content', str)
    return RDFConverter.runExecution(url, form)
  }

  /**
   * Converte utilizzando il servizio Easy Rdf Converter
   * @param str stringa da convertire
   * @param source formato della stringa da convertire
   * @param target formato delle conversione
   * @private
   */
  private static easyRdfConvert(str: string, source: string, target: string) {
    const mapFormat = {
      xml: 'rdfxml',
      n3: 'n3',
      nt: 'ntriples',
      'json-ld': 'jsonld'
    }

    const url = 'http://www.easyrdf.org/converter'
    const form = new FormData()
    form.append('data', str)
    form.append('uri', 'http://njh.me/')
    form.append('raw', '1')
    form.append('in', mapFormat[source] || 'guess')
    form.append('out', mapFormat[target])

    return RDFConverter.runExecution(url, form)
  }

  /**
   * Converte una stringa in formato N3 (molto diffuso) in un formato a scelta
   * @param str stringa da convertire
   * @param output formato di output
   * @returns {Promise<string>} Il testo convertito
   */
  static async convert(str: string, output: OutputFormat): Promise<string> {
    return await RDFConverter.convertFrom(str, 'nt', output)
  }

  /**
   * Converte una stringa in formato in un formato a scelta
   * @param str stringa da convertire
   * @param input formato di input
   * @param output formato di output
   * @returns {Promise<string>} Il testo convertito
   */
  static async convertFrom(
    str: string,
    input: InputFormat,
    output: OutputFormat
  ): Promise<string> {
    try {
      return await RDFConverter.rdfTranslator(str, input, output)
    } catch (err) {
      // Uso Easy RDF Converter come fallback
      console.error(err)
      return await RDFConverter.easyRdfConvert(str, input, output)
    }
  }

  /**
   * Effettua la chiamata al servizio
   * @param url
   * @param form
   * @private
   */
  private static runExecution(url, form) {
    return new Promise<string>((resolve, reject) => {
      let data: any = form
      let opt = {}
      // Nel caso si stia utilizzando form-data di nodejs e non del browser
      if (form.getBuffer) {
        data = form.getBuffer()
        opt = { headers: { ...form.getHeaders() } }
      }
      axios
        .post(url, data, opt)
        .then(response => {
          if (response.status != 200) {
            reject(response.statusText)
          } else {
            resolve(response.data)
          }
        })
        .catch((err: string) => reject(err))
        .finally(() => reject('Errore sconosciuto'))
    })
  }
}
