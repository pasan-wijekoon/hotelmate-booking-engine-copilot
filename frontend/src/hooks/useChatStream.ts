import { useCallback, useRef, useState } from 'react'
import { fetchAiResponse, getErrorMessage } from '../lib/api'

/**
 * Chat response hook. Holds an internal AbortController so callers can stop
 * mid-request. Returns: stream() to start a request, stop() to abort,
 * streaming (boolean), error (string|null), and isTextareaDisabled (boolean).
 */
export function useChatStream() {
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isTextareaDisabled, setIsTextareaDisabled] = useState(true)
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
      setIsTextareaDisabled(true)

      try {
        const body = await fetchAiResponse(params.prompt, {
          signal: controller.signal,
        })

        const reader = body.getReader()
        const decoder = new TextDecoder()
        let assembled = ''
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })

          // Process the buffer for complete JSON objects (one per line)
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed) continue
            try {
              const parsed = JSON.parse(trimmed)

              // Strictly only use 'response' and 'isTextareaDisabled'
              if (typeof parsed.response === 'string') {
                assembled += parsed.response
                if (params.onDelta) {
                  params.onDelta(assembled)
                }
              }

              if (typeof parsed.isTextareaDisabled === 'boolean') {
                setIsTextareaDisabled(parsed.isTextareaDisabled)
              }
            } catch (e) {
              console.error('Malformed JSON chunk received:', e, trimmed)
            }
          }
        }

        // Process final remaining chunk if it's a complete JSON object
        if (buffer.trim()) {
          try {
            const parsed = JSON.parse(buffer.trim())
            if (typeof parsed.response === 'string') {
              assembled += parsed.response
              if (params.onDelta) params.onDelta(assembled)
            }
            if (typeof parsed.isTextareaDisabled === 'boolean') {
              setIsTextareaDisabled(parsed.isTextareaDisabled)
            }
          } catch (e) {
            console.error('Malformed final JSON chunk:', e, buffer)
          }
        }

        return assembled
      } catch (err: any) {
        if (userStoppedRef.current) {
          return ''
        }

        const msg = getErrorMessage(err)
        setError(msg)
        throw err
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null
        }
        setStreaming(false)
        setIsTextareaDisabled(false)
      }
    },
    [],
  )

  return { stream, stop, streaming, error, isTextareaDisabled }
}
