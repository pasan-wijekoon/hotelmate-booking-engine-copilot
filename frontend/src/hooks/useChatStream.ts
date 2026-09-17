import { useCallback, useRef, useState } from 'react'
import { fetchAiResponse } from '../lib/api'

/**
 * Chat response hook. Holds an internal AbortController so callers can stop
 * mid-request. Returns: stream() to start a request, stop() to abort,
 * streaming (boolean), and error (string|null).
 */
export function useChatStream(apiUrl: string, timeoutMs?: number) {
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const userStoppedRef = useRef(false)

  const stop = useCallback(() => {
    userStoppedRef.current = true
    abortRef.current?.abort()
    abortRef.current = null
  }, [])

  const stream = useCallback(
    async (params: {
      prompt: string
      onDelta?: (chunk: string) => void
    }): Promise<string> => {
      // Cancel any in-flight request
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      userStoppedRef.current = false
      setError(null)
      setStreaming(true)

      try {
        const full = await fetchAiResponse(params.prompt, {
          apiUrl,
          timeoutMs,
          signal: controller.signal,
        })
        if (params.onDelta) {
          params.onDelta(full)
        }
        return full
      } catch (err) {
        if (userStoppedRef.current) {
          // User-initiated abort — silent
          return ''
        }
        const msg = err instanceof Error ? err.message : 'Request failed'
        setError(msg)
        throw err
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null
        }
        setStreaming(false)
      }
    },
    [apiUrl, timeoutMs],
  )

  return { stream, stop, streaming, error }
}
