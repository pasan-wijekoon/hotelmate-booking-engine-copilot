import { useCallback, useRef, useState } from 'react'
import { fetchAiResponse, getErrorMessage } from '../lib/api'

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
        const body = await fetchAiResponse(params.prompt, {
          apiUrl,
          timeoutMs,
          signal: controller.signal,
        })

        const reader = body.getReader()
        const decoder = new TextDecoder()
        let assembled = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          assembled += chunk
          if (params.onDelta) {
            params.onDelta(assembled)
          }
        }

        return assembled
      } catch (err: any) {
        if (userStoppedRef.current) {
          // User-initiated abort — silent
          return ''
        }

        // Now that fetchAiResponse handles mapping timeouts to ApiError,
        // any remaining AbortError here is likely an unexpected system abort.
        const msg = getErrorMessage(err)
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
