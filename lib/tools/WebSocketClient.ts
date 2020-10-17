/**
 * Definisce la configurazione accettata dal WebSocket
 */
export type WebSocketConfig = {
  address?: string,
  port?: string
}

export type EventType = string
/**
 * Definisce la struttura di un dato passato da un WebSocket
 *
 * @type E tipologia dell'evento
 * @type P tipologia del payload da passare al WebSocket
 */
export type WebSocketData<E extends EventType, P> = {
  type: E,
  payload: P
}

/**
 * Tipologia di funzione callback da eseguire all'avvento di un evento
 *
 * @type P tipologia di payload ritornato dalla chiamata WebSocket
 */
export type WebSocketCallback<P> = (payload: P) => void

/**
 * Strumento per la gestione di un WebSocket lato browser
 *
 * La classe wrappa l'oggetto WebSocket di sistema implementando metodi per facilitarne l'utilizzo
 * @class
 */
export class WebSocketClient<E extends EventType> {
  /**
   * Indirizzo al websocket.
   * Di default 'localhost'
   * @private
   */
  private readonly address: string = 'ws://localhost'
  /**
   * Porta utilizzata dal websocket.
   * Di default '80'
   * @private
   */
  private readonly port: string = '80'

  /**
   * Istanza del websocket
   * @private
   */
  private webSocket: WebSocket

  /**
   * Registro contenente tutte le callback associate ad ogni evento del WebSocket.
   *
   * @typedef Map<type, Map<identify, WebSocketCallback>>
   * @private
   */
  private eventsRegistry = new Map()
  /**
   * Conteggia le callback dichiarate e serve come identificativo di quest'ultime
   */
  static countIdentify = 1

  constructor (opts?: WebSocketConfig) {
    this.address = opts?.address ?? this.address
    this.port = opts?.port ?? this.port

    const connectionPath = `${this.address}:${this.port}`
    this.webSocket = new WebSocket(connectionPath)
    // Gestione della ricezione di un evento da parte del WS
    this.webSocket.onmessage = (event: MessageEvent) => {
      // Trasformo il messaggio in un oggetto
      const data = JSON.parse(event.data)
      if (!data.type || !data.payload) {
        throw Error('Data recived is invalid')
      }
      // Se è definita qualche callback per il tipo di evento trasmesso
      if (this.eventsRegistry.has(data.type)) {
        const callbacks = this.eventsRegistry.get(data.type)
        if (callbacks && callbacks.size) {
          // Lancio la callback passando il payload come paramentro
          callbacks.forEach(callback => callback(data.payload))
        }
      }
    }
  }

  /**
   * Permette di definire una callback associata ad un particolare evento
   * @param type evento a cui associare la callback
   * @param callback callback da associare
   * @return Identificativo della callback appena registrata
   */
  public on<P>(type: E, callback: WebSocketCallback<P>): number {
    const callbacks: Map<number, WebSocketCallback<P>> = this.eventsRegistry.get(type) || new Map<number, WebSocketCallback<P>>()
    const identify = WebSocketClient.countIdentify++
    callbacks.set(identify, callback)
    this.eventsRegistry.set(type, callbacks)

    return identify
  }

  /**
   * Permette di rimuovere una callback associata ad un evento
   * @param type evento da cui si vuole rimuovere una callback
   * @param callbackIdentify identificativo della callback da eliminare
   */
  public removeListener<P>(type: E, callbackIdentify?: number) {
    if (callbackIdentify) {
      let callbacks: Map<number, WebSocketCallback<P>> = this.eventsRegistry.get(type) || new Map<number, WebSocketCallback<P>>()
      callbacks.delete(callbackIdentify)
      this.eventsRegistry.set(type, callbacks)
    } else {
      this.eventsRegistry.delete(type)
    }
  }

  /**
   * Permette di inviare un messaggio al WS
   * @param message messaggio da inviare al WS
   */
  public send<P>(message: WebSocketData<E, P>): void {
    // Converto il messaggio in stringa
    const strMessage = JSON.stringify(message)
    // L'intervallo serve per garantire che il WS sia pronto a ricevere messaggi
    let interval = setInterval(() => {
      if (this.webSocket.readyState === 1) { // Se WS è pronto
        this.webSocket.send(strMessage)
        clearInterval(interval)
      }
    }, 400)
  }

  /**
   * Emette un messaggio di un particolare tipo al WebSocket
   * @param eventType tipo di messaggio da inviare
   * @param payload contenuto del messaggio da inviare
   */
  public emit<P>(eventType: E, payload: P) {
    const message: WebSocketData<E, P> = {
      type: eventType, payload
    }
    this.send(message)
  }

  /**
   * Evento lanciato appena il WebSocket si è connesso
   * @param callback
   */
  onOpenConnection(callback: () => void) {
    this.webSocket.onopen = callback
  }

  /**
   * Evento lanciato appena la connessione al WebSocket è stata chiusa
   * @param callback
   */
  onCloseConnection(callback: () => void) {
    this.webSocket.onclose = callback
  }

  /**
   * Evento lanciato ogni qualvolta il WebSocket ha dato errore
   * @param callback
   */
  onError(callback: (event) => void) {
    this.webSocket.onerror = callback
  }
}
