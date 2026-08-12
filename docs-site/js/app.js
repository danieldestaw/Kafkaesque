/* Kafkaesque Documentation — shared layout & utilities */
const DocsSite = (() => {
  const NAV = [
    { section: 'Introduction' },
    { id: 'overview', label: 'Overview', href: '/index.html' },
    { id: 'getting-started', label: 'Getting Started', href: '/getting-started.html' },
    { id: 'installation', label: 'Installation', href: '/installation.html' },
    { section: 'Platform' },
    { id: 'architecture', label: 'Architecture', href: '/architecture.html' },
    { id: 'features', label: 'Features', href: '/features.html' },
    { id: 'dashboard', label: 'Dashboard', href: '/dashboard.html' },
    { id: 'rbac', label: 'RBAC & IAM', href: '/rbac.html' },
    { section: 'Integration' },
    { id: 'banking', label: 'Banking Service', href: '/banking-integration.html' },
    { id: 'api', label: 'API Reference', href: '/api-reference.html' },
    { section: 'Operations' },
    { id: 'deployment', label: 'Deployment', href: '/deployment.html' },
    { id: 'development', label: 'Development', href: '/development.html' },
    { id: 'roadmap', label: 'Roadmap', href: '/roadmap.html' },
  ]

  function themeKey() {
    return 'kafkaesque_docs_theme'
  }

  function applyTheme(dark) {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem(themeKey(), dark ? 'dark' : 'light')
    document.querySelectorAll('[data-theme-icon]').forEach((el) => {
      el.textContent = dark ? '☀️' : '🌙'
    })
  }

  function readTheme() {
    const saved = localStorage.getItem(themeKey())
    if (saved === 'dark') return true
    if (saved === 'light') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }

  function renderSidebar(activeId) {
    const path = window.location.pathname
    const page = path.split('/').pop() || 'index.html'
    let html = `
      <div class="sidebar-brand">
        <a href="/index.html" class="brand-link">
          <span class="brand-icon" aria-hidden="true"></span>
          <span>
            <strong>Kafkaesque</strong>
            <small>Documentation</small>
          </span>
        </a>
      </div>
      <nav class="sidebar-nav" aria-label="Documentation">
    `
    NAV.forEach((item) => {
      if (item.section) {
        html += `<p class="nav-section">${item.section}</p>`
        return
      }
      const isActive = item.id === activeId || item.href.endsWith(page) || (page === '' && item.id === 'overview')
      html += `<a href="${item.href}" class="nav-link${isActive ? ' active' : ''}">${item.label}</a>`
    })
    html += `</nav>
      <div class="sidebar-footer">
        <button type="button" class="theme-toggle" data-theme-toggle aria-label="Toggle theme">
          <span data-theme-icon>🌙</span> Theme
        </button>
        <a href="https://github.com/streamforge/streamforge" class="github-link" target="_blank" rel="noopener">GitHub</a>
      </div>`
    return html
  }

  function renderTopbar(title) {
    return `
      <header class="topbar">
        <button type="button" class="menu-btn" data-menu-toggle aria-label="Open menu">☰</button>
        <h1 class="topbar-title">${title}</h1>
        <button type="button" class="theme-toggle topbar-theme" data-theme-toggle aria-label="Toggle theme">
          <span data-theme-icon>🌙</span>
        </button>
      </header>`
  }

  function initCopyButtons() {
    document.querySelectorAll('[data-copy]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const code = btn.closest('.code-block')?.querySelector('code')
        if (!code) return
        try {
          await navigator.clipboard.writeText(code.textContent)
          const label = btn.textContent
          btn.textContent = 'Copied!'
          setTimeout(() => { btn.textContent = label }, 1500)
        } catch {
          btn.textContent = 'Failed'
        }
      })
    })
  }

  function initSearch() {
    const input = document.querySelector('[data-docs-search]')
    if (!input) return
    const items = document.querySelectorAll('[data-search-item]')
    input.addEventListener('input', () => {
      const q = input.value.toLowerCase().trim()
      items.forEach((el) => {
        const text = el.textContent.toLowerCase()
        el.hidden = q.length > 0 && !text.includes(q)
      })
    })
  }

  function init(activeId, pageTitle) {
    const sidebar = document.getElementById('sidebar')
    const topbar = document.getElementById('topbar')
    if (sidebar) sidebar.innerHTML = renderSidebar(activeId)
    if (topbar) topbar.innerHTML = renderTopbar(pageTitle)

    const dark = readTheme()
    applyTheme(dark)

    document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => applyTheme(!document.documentElement.classList.contains('dark')))
    })

    const menuBtn = document.querySelector('[data-menu-toggle]')
    const layout = document.querySelector('.docs-layout')
    menuBtn?.addEventListener('click', () => layout?.classList.toggle('sidebar-open'))

    document.addEventListener('click', (e) => {
      if (layout?.classList.contains('sidebar-open') && !e.target.closest('.sidebar') && !e.target.closest('[data-menu-toggle]')) {
        layout.classList.remove('sidebar-open')
      }
    })

    initCopyButtons()
    initSearch()
  }

  return { init }
})()
