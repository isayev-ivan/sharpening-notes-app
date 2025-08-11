const PREFIX = 'evergreen:'

export function saveJSON<T>(key: string, value: T) {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)) } catch {}
}

export function loadJSON<T>(key: string, fallback: T): T {
    try {
        const raw = localStorage.getItem(PREFIX + key)
        if (!raw) return fallback
        return JSON.parse(raw) as T
    } catch { return fallback }
}

export function removeKey(key: string) {
    try { localStorage.removeItem(PREFIX + key) } catch {}
}
