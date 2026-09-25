import { defineAuditConfig } from '@santi020k/og/audit/config'
import { standardAuditRules } from '@santi020k/og/audit/rules'

export default defineAuditConfig({
  directory: 'dist',
  manifest: 'public/og/manifest.json',
  siteUrl: 'https://doctor.santi020k.com',
  ...standardAuditRules({ sitemap: { reportOrphans: true } })
})
