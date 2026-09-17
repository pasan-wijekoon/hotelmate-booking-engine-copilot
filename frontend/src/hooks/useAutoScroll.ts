import { useCallback, useEffect, useRef, type RefObject } from 'react'

const NEAR_BOTTOM_PX = 80

/**
 * Auto-scroll-to-bottom helper. Tracks whether the user is near the bottom
 * and only auto-scrolls when they are (so reading old messages isn't disrupted).
 */
export function useAutoScroll<T extends HTMLElement>(deps: unknown[]) {
  const ref = useRef<T | null>(null)

  const isNearBottom = useCallback((): boolean => {
    const el = ref.current
    if (!el) return true
    return (
      el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX
    )
  }, [])

  const scrollToBottom = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [])

  // After content updates, scroll if user was near the bottom
  useEffect(() => {
    if (isNearBottom()) {
      scrollToBottom()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return {
    ref: ref as RefObject<T>,
    isNearBottom,
    scrollToBottom,
  }
}
