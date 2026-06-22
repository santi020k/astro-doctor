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

export interface TopIssueData {
  readonly category: string
  readonly column: number
  readonly filePath: string
  readonly line: number
  readonly message: string
  readonly ruleId: string
  readonly severity: 'error' | 'warning'
}

type OpenFileCallback = (params: { filePath: string; line: number }) => void

type WebviewMessage =
  | { readonly data: HealthScoreData; readonly topIssues: TopIssueData[]; readonly type: 'update' }
  | { readonly message: string; readonly type: 'error' }
  | { readonly type: 'loading' }

export const buildSidebarHtml = (nonce: string): string => `<!DOCTYPE html>
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

    /* ── States ── */
    .state-center {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 140px;
      gap: 8px;
      text-align: center;
    }

    .state-icon {
      font-size: 28px;
      line-height: 1;
    }

    .state-title {
      font-size: 13px;
      font-weight: 600;
    }

    .state-body {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      max-width: 180px;
    }

    .error { color: var(--vscode-errorForeground); }

    /* ── Skeleton ── */
    @keyframes shimmer {
      0%   { background-position: -200% 0; }
      100% { background-position:  200% 0; }
    }

    .skeleton {
      background: linear-gradient(
        90deg,
        var(--vscode-input-background) 25%,
        var(--vscode-panel-border)     50%,
        var(--vscode-input-background) 75%
      );
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite;
      border-radius: 4px;
    }

    .skeleton-circle {
      width: 100px;
      height: 100px;
      border-radius: 50%;
    }

    .skeleton-line {
      height: 10px;
      border-radius: 4px;
    }

    .skeleton-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      padding: 16px 0 12px;
    }

    .skeleton-stats {
      display: flex;
      gap: 0;
      width: 100%;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      overflow: hidden;
      margin: 12px 0;
    }

    .skeleton-stat {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 10px 4px;
      border-right: 1px solid var(--vscode-panel-border);
    }

    .skeleton-stat:last-child { border-right: none; }

    .skeleton-categories { display: flex; flex-direction: column; gap: 12px; width: 100%; }

    .skeleton-category { display: flex; flex-direction: column; gap: 6px; }

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

    /* ── Divider ── */
    .divider {
      height: 1px;
      background: var(--vscode-panel-border);
      margin: 14px 0;
    }

    /* ── Top Issues ── */
    .issues { display: flex; flex-direction: column; gap: 6px; }

    .issue {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 7px 9px;
      border-radius: 5px;
      background: var(--vscode-input-background);
      cursor: pointer;
      transition: background 0.15s ease;
      border: 1px solid transparent;
    }

    .issue:hover {
      background: var(--vscode-list-hoverBackground);
      border-color: var(--vscode-panel-border);
    }

    .issue-header {
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .issue-badge {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.06em;
      padding: 1px 5px;
      border-radius: 3px;
      text-transform: uppercase;
      flex-shrink: 0;
    }

    .issue-badge.error  { background: rgba(248,81,73,0.18); color: #f85149; }
    .issue-badge.warn   { background: rgba(210,153,34,0.18); color: #d29922; }

    .issue-rule {
      font-size: 11px;
      font-weight: 600;
      color: var(--vscode-foreground);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .issue-message {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .issue-location {
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
      opacity: 0.7;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  </style>
</head>
<body>
  <div id="root"><div id="skeleton">
    <div class="skeleton-section">
      <div class="skeleton skeleton-circle"></div>
      <div class="skeleton skeleton-line" style="width:70px"></div>
    </div>
    <div class="skeleton-stats">
      <div class="skeleton-stat">
        <div class="skeleton skeleton-line" style="width:28px;height:14px"></div>
        <div class="skeleton skeleton-line" style="width:38px"></div>
      </div>
      <div class="skeleton-stat">
        <div class="skeleton skeleton-line" style="width:28px;height:14px"></div>
        <div class="skeleton skeleton-line" style="width:38px"></div>
      </div>
      <div class="skeleton-stat">
        <div class="skeleton skeleton-line" style="width:28px;height:14px"></div>
        <div class="skeleton skeleton-line" style="width:38px"></div>
      </div>
    </div>
    <div class="skeleton-categories">
      <div class="skeleton-category">
        <div class="skeleton skeleton-line" style="width:100%"></div>
        <div class="skeleton skeleton-line" style="width:100%;height:4px"></div>
      </div>
      <div class="skeleton-category">
        <div class="skeleton skeleton-line" style="width:100%"></div>
        <div class="skeleton skeleton-line" style="width:100%;height:4px"></div>
      </div>
      <div class="skeleton-category">
        <div class="skeleton skeleton-line" style="width:100%"></div>
        <div class="skeleton skeleton-line" style="width:100%;height:4px"></div>
      </div>
      <div class="skeleton-category">
        <div class="skeleton skeleton-line" style="width:100%"></div>
        <div class="skeleton skeleton-line" style="width:100%;height:4px"></div>
      </div>
    </div>
  </div></div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi()
    const root = document.getElementById('root')

    const SCORE_CIRCUMFERENCE = 2 * Math.PI * 42  // r=42

    function scoreColor(s) {
      if (s === 100) return '#a371f7'
      if (s >= 90) return '#3fb950'
      if (s >= 75) return '#d29922'
      if (s >= 60) return '#e3833c'
      return '#f85149'
    }

    function gradeColor(g) {
      if (g === 'S') return '#a371f7'
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

    function basename(filePath) {
      return filePath.replace(/\\\\/g, '/').split('/').pop() || filePath
    }

    function renderTopIssues(issues) {
      if (!issues || issues.length === 0) return ''

      const items = issues.map((issue, index) => \`
        <div class="issue" data-index="\${index}" tabindex="0" role="button"
             aria-label="Open \${basename(issue.filePath)} at line \${issue.line}">
          <div class="issue-header">
            <span class="issue-badge \${issue.severity === 'error' ? 'error' : 'warn'}">
              \${issue.severity}
            </span>
            <span class="issue-rule">\${issue.ruleId.replace('astro-doctor/', '')}</span>
          </div>
          <div class="issue-message">\${issue.message}</div>
          <div class="issue-location">\${basename(issue.filePath)}:\${issue.line}:\${issue.column} &bull; \${categoryLabel(issue.category)}</div>
        </div>
      \`).join('')

      return \`
        <div class="divider"></div>
        <div class="section-title">Top Issues</div>
        <div class="issues" id="issues-list">\${items}</div>
      \`
    }

    function render(data, topIssues) {
      const { score, scoreLabel, scoreBreakdown, fileCount, errorCount, warningCount } = data

      if (fileCount === 0) {
        root.innerHTML = \`
          <div class="state-center">
            <div class="state-icon">🔭</div>
            <div class="state-title">No Astro files found</div>
            <div class="state-body">Open a workspace that contains <code>.astro</code> files to see your health report.</div>
          </div>
        \`
        return
      }



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
        \${renderTopIssues(topIssues)}
      \`

      // Wire up click handlers after DOM is set
      const issuesList = document.getElementById('issues-list')
      if (issuesList && topIssues && topIssues.length > 0) {
        issuesList.querySelectorAll('.issue').forEach((el) => {
          const index = Number(el.getAttribute('data-index'))
          const issue = topIssues[index]
          if (!issue) return
          const activate = () => {
            vscode.postMessage({ type: 'openFile', filePath: issue.filePath, line: issue.line })
          }
          el.addEventListener('click', activate)
          el.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') activate()
          })
        })
      }
    }

    window.addEventListener('message', ({ data }) => {
      if (data.type === 'loading') {
        root.innerHTML = \`
          <div class="skeleton-section">
            <div class="skeleton skeleton-circle"></div>
            <div class="skeleton skeleton-line" style="width:70px"></div>
          </div>
          <div class="skeleton-stats">
            <div class="skeleton-stat">
              <div class="skeleton skeleton-line" style="width:28px;height:14px"></div>
              <div class="skeleton skeleton-line" style="width:38px"></div>
            </div>
            <div class="skeleton-stat">
              <div class="skeleton skeleton-line" style="width:28px;height:14px"></div>
              <div class="skeleton skeleton-line" style="width:38px"></div>
            </div>
            <div class="skeleton-stat">
              <div class="skeleton skeleton-line" style="width:28px;height:14px"></div>
              <div class="skeleton skeleton-line" style="width:38px"></div>
            </div>
          </div>
          <div class="skeleton-categories">
            <div class="skeleton-category">
              <div class="skeleton skeleton-line" style="width:100%"></div>
              <div class="skeleton skeleton-line" style="width:100%;height:4px"></div>
            </div>
            <div class="skeleton-category">
              <div class="skeleton skeleton-line" style="width:100%"></div>
              <div class="skeleton skeleton-line" style="width:100%;height:4px"></div>
            </div>
            <div class="skeleton-category">
              <div class="skeleton skeleton-line" style="width:100%"></div>
              <div class="skeleton skeleton-line" style="width:100%;height:4px"></div>
            </div>
          </div>
        \`
      } else if (data.type === 'error') {
        root.innerHTML = \`
          <div class="state-center error">
            <div class="state-icon">⚠️</div>
            <div class="state-title">Something went wrong</div>
            <div class="state-body">\${data.message}</div>
          </div>
        \`
      } else if (data.type === 'update') {
        render(data.data, data.topIssues)
      }
    })

    vscode.postMessage({ type: 'ready' })
  </script>
</body>
</html>`

export class AstroDoctorSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly VIEW_TYPE = 'astroDoctor.sidebar'

  private latestHealthData?: HealthScoreData
  private latestTopIssues: TopIssueData[] = []
  private openFileCallback?: OpenFileCallback
  private view?: vscode.WebviewView

  public onOpenFile(callback: OpenFileCallback): void {
    this.openFileCallback = callback
  }

  public async resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    this.view = webviewView

    webviewView.webview.options = {
      enableScripts: true,
    }

    const nonce = this.getNonce()

    webviewView.webview.html = buildSidebarHtml(nonce)

    webviewView.webview.onDidReceiveMessage((message: { filePath?: string; line?: number; type: string; }) => {
      if (message.type === 'ready') {
        // Re-send latest data when the view becomes ready
        if (this.latestHealthData) {
          const msg: WebviewMessage = {
            data: this.latestHealthData,
            topIssues: this.latestTopIssues,
            type: 'update',
          }

          void this.view?.webview.postMessage(msg)
        }
      } else if (message.type === 'openFile' && message.filePath && message.line !== undefined) {
        this.openFileCallback?.({ filePath: message.filePath, line: message.line })
      }
    })
  }

  public async setError(message: string): Promise<void> {
    if (!this.view) return

    const msg: WebviewMessage = { message, type: 'error' }

    await this.view.webview.postMessage(msg)
  }

  public async setLoading(): Promise<void> {
    if (!this.view) return

    const message: WebviewMessage = { type: 'loading' }

    await this.view.webview.postMessage(message)
  }

  public async update(data: HealthScoreData): Promise<void> {
    this.latestHealthData = data

    if (!this.view) return

    const message: WebviewMessage = { data, topIssues: this.latestTopIssues, type: 'update' }

    await this.view.webview.postMessage(message)
  }

  public async updateTopIssues(issues: TopIssueData[]): Promise<void> {
    this.latestTopIssues = issues

    if (!this.view || !this.latestHealthData) return

    const message: WebviewMessage = {
      data: this.latestHealthData,
      topIssues: issues,
      type: 'update',
    }

    await this.view.webview.postMessage(message)
  }

  private getNonce(): string {
    let text = ''
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

    for (let index = 0; index < 32; index++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length))
    }

    return text
  }
}
