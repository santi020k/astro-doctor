import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

import { ALL_RULES } from '../src/data/rules'

import {
  DOCS_DESKTOP_WIDTH_PX,
  DOCS_LAYOUT_TOLERANCE_PX,
  DOCS_MOBILE_WIDTH_PX,
  DOCS_NARROW_WIDTH_PX,
  DOCS_NAVIGATION_WIDTH_PX,
  DOCS_TABLET_WIDTH_PX,
  DOCS_TEXT_ZOOM_PERCENT,
  DOCS_VIEWPORT_HEIGHT_PX
} from './constants'

const routes = [
  '/',
  '/docs',
  '/docs/installation',
  '/docs/quick-start',
  '/docs/cli',
  '/docs/configuration',
  '/docs/eslint-plugin',
  '/docs/github-action',
  '/docs/agent-skills',
  '/docs/editor-integration',
  '/docs/vscode-extension',
  '/docs/changelog',
  '/docs/rules',
  '/404',
  ...ALL_RULES.map(rule => `/docs/rules/${rule.slug}`)
]

for (const width of [DOCS_MOBILE_WIDTH_PX, DOCS_DESKTOP_WIDTH_PX]) {
  for (const theme of ['light', 'dark']) {
    test(`all routes are readable and accessible at ${width}px in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: DOCS_VIEWPORT_HEIGHT_PX })

      await page.emulateMedia({ reducedMotion: 'reduce' })

      await page.addInitScript(selectedTheme => {
        localStorage.setItem('theme', selectedTheme)
      }, theme)

      const browserErrors: string[] = []

      page.on('pageerror', error => browserErrors.push(error.message))

      for (const route of routes) {
        await test.step(route, async () => {
          const response = await page.goto(route)

          expect(response?.status()).toBe(200)

          await expect(page).toHaveTitle(/astro-doctor/u)

          await expect(page.locator('main h1')).toHaveCount(1)

          await expect(page.locator('html')).toHaveAttribute('data-theme', theme)

          await expect(page.locator('main')).toBeVisible()

          const layout = await page.evaluate(() => ({
            viewport: document.documentElement.clientWidth,
            content: document.documentElement.scrollWidth
          }))

          expect(layout.content).toBeLessThanOrEqual(layout.viewport + DOCS_LAYOUT_TOLERANCE_PX)

          const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()

          expect(accessibility.violations).toEqual([])

          const unsafeLinks = await page.locator('a[target="_blank"]').evaluateAll(links => links.filter(link => {
            const relationship = link.getAttribute('rel')?.split(/\s/u)

            return !relationship?.includes('noopener') || !relationship.includes('noreferrer')
          }).map(link => link.getAttribute('href')))

          expect(unsafeLinks).toEqual([])

          const captureDirectory = process.env.DOCS_CAPTURE_DIR

          if (captureDirectory) {
            await mkdir(captureDirectory, { recursive: true })

            await page.screenshot({ path: join(captureDirectory, `after-${route.replaceAll('/', '-').replace(/^-+/u, '') || 'home'}-${width}-${theme}.png`), fullPage: true })
          }
        })
      }

      expect(browserErrors).toEqual([])
    })
  }
}

test('theme, tabs, and copy continue working across client navigation', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])

  await page.emulateMedia({ reducedMotion: 'reduce' })

  await page.addInitScript(() => {
    localStorage.setItem('theme', 'light')
  })

  await page.goto('/')

  await page.evaluate(() => {
    document.addEventListener('astro:after-swap', () => {
      document.documentElement.dataset.testNavigation = 'retained'
    })
  })

  await page.getByRole('button', { name: 'Dark color theme', exact: true }).click()

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

  await expect(page.getByRole('button', { name: 'Dark color theme', exact: true })).toHaveAttribute('aria-pressed', 'true')

  await page.locator('main').getByRole('link', { name: 'Run your first scan', exact: true }).click()

  await expect(page).toHaveURL(/\/docs\/quick-start\/?$/u)

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

  await expect(page.getByRole('button', { name: 'Dark color theme', exact: true })).toHaveAttribute('aria-pressed', 'true')

  await expect(page.locator('html')).toHaveAttribute('data-test-navigation', 'retained')

  await page.getByRole('tab', { name: 'npm', exact: true }).first().click()

  await expect(page.getByRole('tab', { name: 'npm', exact: true }).first()).toHaveAttribute('aria-selected', 'true')

  await page.getByRole('tab', { name: 'npm', exact: true }).first().press('ArrowRight')

  await expect(page.getByRole('tab', { name: 'yarn', exact: true }).first()).toHaveAttribute('aria-selected', 'true')

  await page.getByRole('tab', { name: 'pnpm', exact: true }).first().click()

  const activePanel = page.getByRole('tabpanel').filter({ visible: true }).first()

  await activePanel.getByRole('button', { name: /copy/iu }).click()

  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain('pnpm')

  await page.getByRole('button', { name: 'Dark color theme', exact: true }).click()

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')

  await page.goBack()

  await expect(page.locator('main h1')).toContainText('Your agent writes')

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
})

test('mobile navigation traps focus, closes safely, and opens after page swaps', async ({ page }) => {
  await page.setViewportSize({ width: DOCS_MOBILE_WIDTH_PX, height: DOCS_VIEWPORT_HEIGHT_PX })

  await page.goto('/')

  const trigger = page.getByRole('button', { name: 'Open navigation', exact: true })
  const panel = page.getByRole('dialog', { name: 'Explore the docs.' })

  await trigger.click()

  await expect(panel).toBeVisible()

  await page.getByRole('button', { name: 'Close navigation', exact: true }).focus()

  await page.keyboard.press('Shift+Tab')

  await expect(panel).toBeFocused()

  await page.keyboard.press('Tab')

  await expect(page.getByRole('button', { name: 'Close navigation', exact: true })).toBeFocused()

  await page.keyboard.press('Escape')

  await expect(panel).not.toBeVisible()

  await expect(trigger).toBeFocused()

  await trigger.click()

  await panel.getByRole('link', { name: 'Configuration', exact: true }).click()

  await expect(page).toHaveURL(/\/docs\/configuration\/?$/u)

  await expect(panel).not.toBeVisible()

  await trigger.click()

  await expect(panel).toBeVisible()

  await page.setViewportSize({ width: DOCS_DESKTOP_WIDTH_PX, height: DOCS_VIEWPORT_HEIGHT_PX })

  await expect(panel).not.toBeVisible()

  await expect(page.getByRole('navigation', { name: 'Primary', exact: true })).toBeVisible()
})

test('tablet navigation switches to one desktop navigation at the breakpoint', async ({ page }) => {
  await page.setViewportSize({ width: DOCS_TABLET_WIDTH_PX, height: DOCS_VIEWPORT_HEIGHT_PX })

  await page.goto('/docs/cli')

  const navigation = page.getByRole('navigation', { name: 'Primary', exact: true })
  const trigger = page.getByRole('button', { name: 'Open navigation', exact: true })

  await expect(navigation).toBeHidden()

  await expect(trigger).toBeVisible()

  await trigger.click()

  await expect(page.getByRole('dialog', { name: 'Explore the docs.' })).toBeVisible()

  await page.setViewportSize({ width: DOCS_NAVIGATION_WIDTH_PX, height: DOCS_VIEWPORT_HEIGHT_PX })

  await expect(page.getByRole('dialog', { name: 'Explore the docs.' })).not.toBeVisible()

  await expect(trigger).toBeHidden()

  await expect(navigation).toBeVisible()

  await expect(navigation.getByRole('link', { name: 'CLI', exact: true })).toHaveAttribute('aria-current', 'page')
})

test('narrow and enlarged text layouts stay within the viewport', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })

  for (const width of [DOCS_NARROW_WIDTH_PX, DOCS_DESKTOP_WIDTH_PX]) {
    await page.setViewportSize({ width, height: DOCS_VIEWPORT_HEIGHT_PX })

    for (const route of ['/', '/docs/cli', '/docs/rules/no-unprocessed-script-surprises']) {
      await page.goto(route)

      await page.evaluate(zoom => {
        document.documentElement.style.fontSize = zoom
      }, DOCS_TEXT_ZOOM_PERCENT)

      const overflow = await page.evaluate(() => {
        const documentRoot = document.documentElement

        return documentRoot.scrollWidth - documentRoot.clientWidth
      })

      expect(overflow).toBeLessThanOrEqual(DOCS_LAYOUT_TOLERANCE_PX)

      const contentBounds = await page.locator(
        '.site-header-brand, .site-header-actions :is(a, button):visible, main h1, main [data-slot=button-link]:visible'
      ).evaluateAll(elements => elements.map(element => ({
        label: element.getAttribute('aria-label') ?? element.textContent,
        left: element.getBoundingClientRect().left,
        right: element.getBoundingClientRect().right
      })))

      for (const bounds of contentBounds) {
        expect(bounds.left, `${bounds.label} starts inside the viewport`).toBeGreaterThanOrEqual(-DOCS_LAYOUT_TOLERANCE_PX)

        expect(bounds.right, `${bounds.label} ends inside the viewport`).toBeLessThanOrEqual(width + DOCS_LAYOUT_TOLERANCE_PX)
      }

      const captureDirectory = process.env.DOCS_CAPTURE_DIR

      if (captureDirectory) {
        await mkdir(captureDirectory, { recursive: true })

        await page.screenshot({
          path: join(captureDirectory, `enlarged-${route.replaceAll('/', '-').replace(/^-+/u, '') || 'home'}-${width}.png`),
          fullPage: true
        })
      }
    }
  }
})

test('content remains readable without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: DOCS_MOBILE_WIDTH_PX, height: DOCS_VIEWPORT_HEIGHT_PX }
  })

  const page = await context.newPage()

  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Good habits. Where you already work.' })).toBeVisible()

  await expect(page.getByRole('navigation', { name: 'Primary', exact: true })).toBeVisible()

  await expect(page.getByRole('button', { name: 'Open navigation', exact: true })).toBeHidden()

  await page.locator('main').getByRole('link', { name: 'Run your first scan', exact: true }).click()

  await expect(page.locator('main h1')).toContainText('Quick start')

  await context.close()
})

test('page navigation keeps directional links usable on desktop and mobile', async ({ page }) => {
  await page.setViewportSize({ width: DOCS_DESKTOP_WIDTH_PX, height: DOCS_VIEWPORT_HEIGHT_PX })

  await page.goto('/docs/cli')

  const navigation = page.getByRole('navigation', { name: 'Previous and next pages', exact: true })
  const previous = navigation.getByRole('link', { name: 'Previous ESLint Plugin' })
  const next = navigation.getByRole('link', { name: 'Next GitHub Action' })

  await expect(previous).toHaveAttribute('href', '/docs/eslint-plugin')

  await expect(next).toHaveAttribute('href', '/docs/github-action')

  await expect(next).toHaveCSS('text-align', 'right')

  const desktopPrevious = await previous.boundingBox()
  const desktopNext = await next.boundingBox()

  expect(desktopPrevious?.y).toBe(desktopNext?.y)

  await page.setViewportSize({ width: DOCS_MOBILE_WIDTH_PX, height: DOCS_VIEWPORT_HEIGHT_PX })

  await next.scrollIntoViewIfNeeded()

  const mobilePrevious = await previous.boundingBox()
  const mobileNext = await next.boundingBox()

  expect(mobilePrevious).not.toBeNull()

  expect(mobileNext).not.toBeNull()

  if (mobilePrevious && mobileNext) {
    expect(mobileNext.y).toBeGreaterThan(mobilePrevious.y + mobilePrevious.height)
  }

  await next.focus()

  await page.keyboard.press('Enter')

  await expect(page).toHaveURL(/\/docs\/github-action\/?$/u)

  await page.goto('/docs')

  await expect(navigation.getByRole('link')).toHaveCount(1)

  await expect(navigation.getByRole('link', { name: 'Next Installation' })).toHaveAttribute('href', '/docs/installation')
})

test('wide reference tables can be scrolled with a keyboard', async ({ page }) => {
  await page.setViewportSize({ width: DOCS_MOBILE_WIDTH_PX, height: DOCS_VIEWPORT_HEIGHT_PX })

  await page.goto('/docs/cli')

  const options = page.getByRole('region', { name: 'CLI options', exact: true })

  await expect(options.locator('table')).toHaveCSS('display', 'table')

  await expect(options.locator('table')).toHaveCSS('overflow-x', 'visible')

  await expect.poll(() => options.evaluate(element => element.scrollWidth - element.clientWidth)).toBeGreaterThan(0)

  await options.focus()

  await page.keyboard.press('ArrowRight')

  await expect.poll(() => options.evaluate(element => element.scrollLeft)).toBeGreaterThan(0)
})

test('reduced motion keeps every revealed section immediately available', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })

  await page.goto('/')

  await expect(page.locator('html')).toHaveCSS('scroll-behavior', 'auto')

  const revealedSections = page.locator('[data-ui-scroll-reveal]')

  await expect(revealedSections.first()).toBeVisible()

  expect(await revealedSections.evaluateAll(elements => elements.every(element => getComputedStyle(element).opacity === '1'))).toBe(true)

  expect(await page.evaluate(() => document.getAnimations().some(animation => animation.playState === 'running'))).toBe(false)
})
