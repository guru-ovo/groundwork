/**
 * Minimal server-sent-events parser.
 *
 * EventSource can't be used here: it is GET-only and the plan request needs
 * a body. So we read the fetch stream ourselves, which means handling the
 * case where a chunk boundary lands mid-event — hence the buffer.
 */
export function createSSEParser(onEvent) {
  let buffer = ''

  return function push(chunk) {
    buffer += chunk
    let boundary
    while ((boundary = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, boundary)
      buffer = buffer.slice(boundary + 2)
      for (const line of frame.split('\n')) {
        if (!line.startsWith('data: ')) continue // ':' lines are heartbeats
        try {
          onEvent(JSON.parse(line.slice(6)))
        } catch {
          // A malformed frame must not kill the stream — the next event
          // may be the plan itself.
        }
      }
    }
  }
}
