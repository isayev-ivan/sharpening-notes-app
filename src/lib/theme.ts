const STORAGE_KEY = 'theme:v1'
export type Theme = 'light' | 'dark'

export function getSystemTheme(): Theme {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function loadTheme(): Theme | null {
    try { return (localStorage.getItem(STORAGE_KEY) as Theme) || null } catch { return null }
}

export function saveTheme(t: Theme) {
    try { localStorage.setItem(STORAGE_KEY, t) } catch {}
}

export function applyTheme(t: Theme) {
    document.documentElement.setAttribute('data-theme', t)
}

export function initTheme() {
    const stored = loadTheme()
    const initial = stored ?? getSystemTheme()
    applyTheme(initial)
}
