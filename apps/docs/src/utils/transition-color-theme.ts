import {
  THEME_TRANSITION_DURATION_MS,
  THEME_TRANSITION_FALLBACK_DELAY_MS,
  THEME_TRANSITION_Z_INDEX
} from '@/constants'

export const transitionColorTheme = (
  toggle: HTMLElement,
  applyTheme: () => void
): void => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const isTouchDevice = window.matchMedia('(hover: none) and (pointer: coarse)').matches
  const activeOverlay = document.querySelector('[data-theme-transition-overlay]')

  if (activeOverlay) return

  if (prefersReducedMotion || isTouchDevice) {
    applyTheme()

    return
  }

  const rect = toggle.getBoundingClientRect()
  const originX = Math.round(rect.left + (rect.width / 2))
  const originY = Math.round(rect.top + (rect.height / 2))
  const horizontalRadius = Math.max(originX, window.innerWidth - originX)
  const verticalRadius = Math.max(originY, window.innerHeight - originY)
  const maximumRadius = Math.hypot(horizontalRadius, verticalRadius)
  const overlay = document.createElement('div')

  overlay.dataset.themeTransitionOverlay = ''

  overlay.setAttribute('aria-hidden', 'true')

  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    zIndex: String(THEME_TRANSITION_Z_INDEX),
    pointerEvents: 'none',
    backgroundColor: getComputedStyle(document.body).backgroundColor,
    clipPath: `circle(${maximumRadius}px at ${originX}px ${originY}px)`,
    willChange: 'clip-path'
  })

  document.body.appendChild(overlay)

  applyTheme()

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      overlay.style.transition = `clip-path ${THEME_TRANSITION_DURATION_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`

      overlay.style.clipPath = `circle(0 at ${originX}px ${originY}px)`

      const complete = (): void => {
        overlay.remove()
      }

      overlay.addEventListener('transitionend', complete, { once: true })

      window.setTimeout(complete, THEME_TRANSITION_FALLBACK_DELAY_MS)
    })
  })
}
