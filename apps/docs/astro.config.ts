import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'

import { SITE_URL } from './src/site.config'

// https://astro.build/config
export default defineConfig({
  site: SITE_URL,
  output: 'static',
  integrations: [
    mdx(),
    sitemap()
  ],
  markdown: {
    shikiConfig: {
      themes: {
        light: 'catppuccin-latte',
        dark: 'catppuccin-mocha'
      }
    }
  },
  prefetch: true,
  vite: {
    plugins: [tailwindcss()]
  }
})
