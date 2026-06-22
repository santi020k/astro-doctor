/**
 * Satori-based OG card renderer for astro-doctor docs.
 * Matches the brand aesthetic of public/og.svg — dark background,
 * purple gradient accent, orange logo mark, Inter typeface.
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { Resvg } from '@resvg/resvg-js'
import satori from 'satori'
import * as satoriHtml from 'satori-html'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
// ─── Assets ──────────────────────────────────────────────────────────────────
const faviconSvg = readFileSync(path.join(ROOT, 'public', 'favicon.svg'))

const iconBuf = await sharp(faviconSvg)
  .resize(72, 72, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer()

const ICON_URI = `data:image/png;base64,${iconBuf.toString('base64')}`

// ─── Fonts (Montserrat TTF, committed to public/fonts/) ──────────────────────

const FONTS = [
  {
    name: 'Montserrat',
    data: readFileSync(path.join(ROOT, 'public', 'fonts', 'Montserrat-Regular.ttf')),
    style: 'normal',
    weight: 400
  },
  {
    name: 'Montserrat',
    data: readFileSync(path.join(ROOT, 'public', 'fonts', 'Montserrat-ExtraBold.ttf')),
    style: 'normal',
    weight: 900
  }
]

// ─── Card tokens ──────────────────────────────────────────────────────────────

const CATEGORY_COLORS = {
  performance: { text: '#f97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.25)' },
  accessibility: { text: '#3b82f6', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.25)' },
  security: { text: '#ef4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.25)'  },
  'best-practices': { text: '#22c55e', bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.25)'  }
}

const titleFontSize = title => {
  if (title.length <= 22) return 88

  if (title.length <= 40) return 74

  if (title.length <= 58) return 60

  return 48
}

const escape = s => s
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll('\'', '&#39;')

const truncate = (s, max = 130) => s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s

// ─── Card template ────────────────────────────────────────────────────────────

const renderCard = ({ title, description, type, category }) => {
  const size = titleFontSize(title)
  const cat = category ? CATEGORY_COLORS[category] : null

  const categoryBadge = cat ?
    `
    <div style="display:flex;align-items:center;gap:8px;">
      <div style="
        display:flex;align-items:center;padding:6px 16px;border-radius:6px;
        background:${cat.bg};border:1px solid ${cat.border};
      ">
        <span style="
          display:flex;font-size:13px;font-weight:700;color:${cat.text};
          text-transform:uppercase;letter-spacing:0.1em;
        ">${escape(category)}</span>
      </div>
    </div>
  ` :
    ''

  const descHtml = description ?
    `
    <p style="
      display:flex;margin:0;font-size:22px;line-height:1.55;
      color:#94a3b8;max-width:880px;
    ">${escape(truncate(description))}</p>
  ` :
    ''

  return `
    <div style="
      display:flex;width:1200px;height:630px;flex-direction:column;
      background:linear-gradient(135deg,#0d0d14 0%,#120d1e 100%);
      font-family:'Montserrat',sans-serif;
    ">
      <!-- Top border accent -->
      <div style="
        display:flex;width:1200px;height:3px;flex-shrink:0;
        background:linear-gradient(90deg,#7c3aed 0%,#a855f7 100%);
      "></div>

      <!-- Content -->
      <div style="display:flex;flex:1;flex-direction:column;padding:52px 64px;">

        <!-- Header -->
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:16px;">
            <img src="${ICON_URI}" style="display:flex;width:72px;height:72px;" />
            <div style="display:flex;flex-direction:column;gap:4px;">
              <span style="
                display:flex;font-size:22px;font-weight:600;color:#a78bfa;letter-spacing:1px;
              ">astro-doctor</span>
              <span style="display:flex;font-size:14px;color:#4b5563;letter-spacing:0.4px;">
                doctor.santi020k.com
              </span>
            </div>
          </div>
          <div style="
            display:flex;align-items:center;padding:12px 24px;border-radius:999px;
            background:linear-gradient(135deg,#7c3aed,#a855f7);
          ">
            <span style="
              display:flex;font-size:16px;font-weight:700;color:#fff;
              letter-spacing:0.14em;text-transform:uppercase;
            ">${escape(type)}</span>
          </div>
        </div>

        <!-- Body -->
        <div style="display:flex;flex-direction:column;flex:1;justify-content:center;gap:22px;">
          <div style="
            display:flex;width:80px;height:3px;border-radius:999px;
            background:linear-gradient(90deg,#7c3aed,#a855f7);
          "></div>
          <h1 style="
            display:flex;margin:0;font-size:${size}px;font-weight:900;
            line-height:1.08;letter-spacing:-0.03em;color:#fff;max-width:1050px;
          ">${escape(title)}</h1>
          ${descHtml}
        </div>

        <!-- Footer: category badge or empty -->
        <div style="display:flex;height:40px;align-items:flex-end;">
          ${categoryBadge}
        </div>
      </div>
    </div>
  `
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * @param {{ title: string, description?: string, type: string, category?: string }} props
 * @returns {Promise<Buffer>} WebP image buffer
 */
export const renderOgCard = async props => {
  const html = renderCard(props).trim()
  const markup = /** @type {Parameters<typeof satori>[0]} */ (satoriHtml.html(html))
  const svg = await satori(markup, { width: 1200, height: 630, fonts: FONTS })
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng()

  return sharp(png).webp({ quality: 82, effort: 0 }).toBuffer()
}
