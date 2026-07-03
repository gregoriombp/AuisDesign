import type { Response } from "express"
import type { BridgeEvent } from "./types.js"

type Subscriber = {
  id: number
  res: Response
}

let nextId = 1
const subscribers = new Set<Subscriber>()

function send(res: Response, event: string, data: unknown): boolean {
  try {
    res.write(`event: ${event}\n`)
    res.write(`data: ${JSON.stringify(data)}\n\n`)
    return true
  } catch {
    return false
  }
}

export function attachSubscriber(res: Response): () => void {
  const sub: Subscriber = { id: nextId++, res }
  subscribers.add(sub)

  send(res, "hello", {
    kind: "hello",
    serverStartedAt: SERVER_STARTED_AT,
  } satisfies BridgeEvent)

  return () => {
    subscribers.delete(sub)
  }
}

export function broadcast(event: BridgeEvent): void {
  for (const sub of subscribers) {
    const ok = send(sub.res, event.kind, event)
    if (!ok) subscribers.delete(sub)
  }
}

export function broadcastHeartbeat(): void {
  for (const sub of subscribers) {
    try {
      sub.res.write(`: heartbeat ${Date.now()}\n\n`)
    } catch {
      subscribers.delete(sub)
    }
  }
}

export function subscriberCount(): number {
  return subscribers.size
}

export const SERVER_STARTED_AT = Date.now()
