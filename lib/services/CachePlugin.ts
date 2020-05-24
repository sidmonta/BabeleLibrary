/**
 * Interfaccia che definisce le operazioni fondamentali per un plugin che faccia da cache
 *
 * @template K Tipologia della chiave
 * @template V Tipologia del valore cacheto
 */
export interface CachePlugin<K, V> {
  /**
   * Verifica la presenza di una chiave nella cache
   * @template K Tipologia della chiave
   * @param key chiave da verificare
   * @return True se la chiave è presente nella cache, False altrimenti
   */
  has(key: K): boolean

  /**
   * Recupera il valore della cache
   * @param key chiave da cercare
   * @return il valore cacheto corrispondente a quella value, oppure undefined se non è presente
   */
  get(key: K): V | undefined

  /**
   * Aggiunge un valore associato ad una chiave nella cache
   * @param key chiave associata al valore
   * @param value valore da cachere
   * @return True se il salvataggio nella cache è andato a buon fine, False altrimenti
   */
  add(key: K, value: V): boolean

  /**
   * Rimuove il valore corrispondente a quella chiave dalla cache
   * @param key chiave associata al valore da togliere
   * @return True se la rimozione è avvenuta con successo, False altrimenti
   */
  remove(key: K): boolean

  /**
   * Svuota la cache
   * @return True se la cache è stata svuotata, False altrimenti.
   */
  flush(): boolean
}

/**
 * Plugin che utilizza come Cache una variabile salvata in memoria.
 */
export class InMemoryPlugin<K, V> implements CachePlugin<K, V> {
  private memory: Map<K, V>

  constructor () {
    this.memory = new Map<K, V>()
  }

  has (key: K): boolean {
    return this.memory.has(key)
  }

  get (key: K): V | undefined {
    return this.memory.get(key)
  }

  add (key: K, value: V): boolean {
    try {
      this.memory.set(key, value)
      return true
    } catch(er) {
      return false
    }
  }

  remove (key: K): boolean {
    try {
      this.memory.delete(key)
      return true
    } catch (e) {
      return false
    }
  }

  flush (): boolean {
    this.memory.clear()
    return true
  }
}
