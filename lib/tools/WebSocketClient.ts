export type WebSocketConfig = {
  address?: string,
  port?: string
}

export type EventType = string

export type WebSocketData<E extends EventType, P> = {
  type: E,
  payload: P
}

export type WebSocketCallback<P> = (payload: P) => void

export class WebSocketClient<E extends EventType> {
  private readonly address: string = 'ws://localhost'
  private readonly port: string = '80'

  private webSocket: WebSocket

  private eventsRegistry = new Map() // Map<type, Map<identify, WebSocketCallback>>
  static countIdentify = 1

  constructor (opts?: WebSocketConfig) {
    this.address = opts?.address ?? this.address
    this.port = opts?.port ?? this.port

    const connectionPath = `${this.address}:${this.port}`
    this.webSocket = new WebSocket(connectionPath)

    this.webSocket.onmessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data)
      if (!data.type || !data.payload) {
        throw Error('Data recived is invalid')
      }
      if (this.eventsRegistry.has(data.type)) {
        const callbacks = this.eventsRegistry.get(data.type)
        if (callbacks && callbacks.size) {
          callbacks.forEach(callback => callback(data.payload))
        }
      }
    }
  }

  public on<P>(type: E, callback: WebSocketCallback<P>): number {
    const callbacks: Map<number, WebSocketCallback<P>> = this.eventsRegistry.get(type) || new Map<number, WebSocketCallback<P>>()
    const identify = WebSocketClient.countIdentify++
    callbacks.set(identify, callback)
    this.eventsRegistry.set(type, callbacks)

    return identify
  }

  public removeListener<P>(type: E, callbackIdentify?: number) {
    if (callbackIdentify) {
      let callbacks: Map<number, WebSocketCallback<P>> = this.eventsRegistry.get(type) || new Map<number, WebSocketCallback<P>>()
      callbacks.delete(callbackIdentify)
      this.eventsRegistry.set(type, callbacks)
    } else {
      this.eventsRegistry.delete(type)
    }
  }

  public send<P>(message: WebSocketData<E, P>): void {
    const strMessage = JSON.stringify(message)

    let interval = setInterval(() => {
      if (this.webSocket.readyState === 1) {
        this.webSocket.send(strMessage)
        clearInterval(interval)
      }
    }, 400)
  }

  public emit<P>(eventType: E, payload: P) {
    const message: WebSocketData<E, P> = {
      type: eventType, payload
    }
    this.send(message)
  }

  onOpenConnection(callback: () => void) {
    this.webSocket.onopen = callback
  }
  onCloseConnection(callback: () => void) {
    this.webSocket.onclose = callback
  }
  onError(callback: (event) => void) {
    this.webSocket.onerror = callback
  }
}
