import type * as vscode from 'vscode'

export interface HealthScoreData {
  readonly errorCount: number
  readonly fileCount: number
  readonly score: number
  readonly scoreBreakdown: {
    readonly accessibility: number
    readonly 'best-practices': number
    readonly performance: number
    readonly security: number
  }
  readonly scoreLabel: string
  readonly warningCount: number
}

type WebviewMessage =
  | { readonly data: HealthScoreData; readonly type: 'update'; }
  | { readonly message: string; readonly type: 'error'; }
  | { readonly type: 'loading' }


const buildSidebarHtml = (nonce: string): string => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Astro Doctor</title>
  <style nonce="${nonce}">
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      padding: 12px;
      line-height: 1.4;
    }

    .loading, .error {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 120px;
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      text-align: center;
    }

    .error { color: var(--vscode-errorForeground); }

    /* ── Score circle ── */
    .score-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 16px 0 12px;
    }

    .score-ring-wrap {
      position: relative;
      width: 100px;
      height: 100px;
    }

    .score-ring-wrap svg {
      transform: rotate(-90deg);
    }

    .score-ring-track {
      fill: none;
      stroke: var(--vscode-input-background);
      stroke-width: 8;
    }

    .score-ring-fill {
      fill: none;
      stroke-width: 8;
      stroke-linecap: round;
      transition: stroke-dashoffset 0.6s ease, stroke 0.4s ease;
    }

    .score-center {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1px;
    }

    .score-number {
      font-size: 22px;
      font-weight: 700;
      line-height: 1;
    }

    .score-grade {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.06em;
      opacity: 0.75;
    }

    .score-title {
      margin-top: 8px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    /* ── Stats row ── */
    .stats {
      display: flex;
      gap: 0;
      margin: 12px 0;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      overflow: hidden;
    }

    .stat {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 8px 4px;
      border-right: 1px solid var(--vscode-panel-border);
    }

    .stat:last-child { border-right: none; }

    .stat-value {
      font-size: 16px;
      font-weight: 700;
      line-height: 1.2;
    }

    .stat-value.error  { color: #f85149; }
    .stat-value.warn   { color: #d29922; }

    .stat-label {
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
      margin-top: 2px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    /* ── Categories ── */
    .section-title {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px;
    }

    .categories { display: flex; flex-direction: column; gap: 10px; }

    .category { display: flex; flex-direction: column; gap: 4px; }

    .category-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .category-name {
      font-size: 12px;
      font-weight: 500;
    }

    .category-score {
      font-size: 12px;
      font-weight: 600;
    }

    .progress {
      height: 4px;
      background: var(--vscode-input-background);
      border-radius: 2px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      border-radius: 2px;
      transition: width 0.5s ease, background 0.4s ease;
    }

    .divider {
      height: 1px;
      background: var(--vscode-panel-border);
      margin: 14px 0;
    }
  </style>
</head>
<body>
  <div id="root"><div class="loading">Connecting to Astro Doctor…</div></div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi()
    const root = document.getElementById('root')

    const SCORE_CIRCUMFERENCE = 2 * Math.PI * 42  // r=42

    function scoreColor(s) {
      if (s >= 90) return '#3fb950'
      if (s >= 75) return '#d29922'
      if (s >= 60) return '#e3833c'
      return '#f85149'
    }

    function gradeColor(g) {
      if (g === 'A') return '#3fb950'
      if (g === 'B') return '#d29922'
      if (g === 'C') return '#e3833c'
      return '#f85149'
    }

    function progressColor(s) {
      if (s >= 80) return '#3fb950'
      if (s >= 60) return '#d29922'
      return '#f85149'
    }

    function categoryLabel(key) {
      const map = {
        'performance': 'Performance',
        'accessibility': 'Accessibility',
        'security': 'Security',
        'best-practices': 'Best Practices'
      }
      return map[key] || key
    }

    function render(data) {
      const { score, scoreLabel, scoreBreakdown, fileCount, errorCount, warningCount } = data
      const dashOffset = SCORE_CIRCUMFERENCE * (1 - score / 100)
      const color = scoreColor(score)
      const gColor = gradeColor(scoreLabel)

      const categories = Object.entries(scoreBreakdown)
        .map(([key, val]) => \`
          <div class="category">
            <div class="category-header">
              <span class="category-name">\${categoryLabel(key)}</span>
              <span class="category-score" style="color:\${progressColor(val)}">\${val}</span>
            </div>
            <div class="progress">
              <div class="progress-fill" style="width:\${val}%;background:\${progressColor(val)}"></div>
            </div>
          </div>
        \`).join('')

      root.innerHTML = \`
        <div class="score-section">
          <div class="score-ring-wrap">
            <svg viewBox="0 0 100 100" width="100" height="100">
              <circle class="score-ring-track" cx="50" cy="50" r="42" />
              <circle class="score-ring-fill"
                cx="50" cy="50" r="42"
                stroke="\${color}"
                stroke-dasharray="\${SCORE_CIRCUMFERENCE}"
                stroke-dashoffset="\${dashOffset}" />
            </svg>
            <div class="score-center">
              <span class="score-number" style="color:\${color}">\${score}</span>
              <span class="score-grade" style="color:\${gColor}">Grade \${scoreLabel}</span>
            </div>
          </div>
          <span class="score-title">Health Score</span>
        </div>

        <div class="stats">
          <div class="stat">
            <span class="stat-value">\${fileCount}</span>
            <span class="stat-label">Files</span>
          </div>
          <div class="stat">
            <span class="stat-value\${errorCount > 0 ? ' error' : ''}">\${errorCount}</span>
            <span class="stat-label">Errors</span>
          </div>
          <div class="stat">
            <span class="stat-value\${warningCount > 0 ? ' warn' : ''}">\${warningCount}</span>
            <span class="stat-label">Warnings</span>
          </div>
        </div>

        <div class="divider"></div>
        <div class="section-title">By Category</div>
        <div class="categories">\${categories}</div>
      \`
    }

    window.addEventListener('message', ({ data }) => {
      if (data.type === 'loading') {
        root.innerHTML = '<div class="loading">Scanning…</div>'
      } else if (data.type === 'error') {
        root.innerHTML = \`<div class="error">\${data.message}</div>\`
      } else if (data.type === 'update') {
        render(data.data)
      }
    })
  </script>
</body>
</html>`

export class AstroDoctorSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly VIEW_TYPE = 'astroDoctor.sidebar'

  private view?: vscode.WebviewView

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.view = webviewView

    webviewView.webview.options = {
      enableScripts: true,
    }

    const nonce = this.getNonce()

    webviewView.webview.html = buildSidebarHtml(nonce)
  }

  public setError(message: string): void {
    if (!this.view) return

    const msg: WebviewMessage = { message, type: 'error' }

    void this.view.webview.postMessage(msg)
  }

  public setLoading(): void {
    if (!this.view) return

    const message: WebviewMessage = { type: 'loading' }

    void this.view.webview.postMessage(message)
  }

  public update(data: HealthScoreData): void {
    if (!this.view) return

    const message: WebviewMessage = { data, type: 'update' }

    void this.view.webview.postMessage(message)
  }

  private getNonce(): string {
    let text = ''
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length))
    }

    return text
  }
}
