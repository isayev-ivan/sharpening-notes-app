// src/lib/seo.ts
import manifest from 'virtual:notes-manifest'
import graph from 'virtual:notes-graph'

const SITE_NAME: string = (import.meta as any).env?.VITE_SITE_NAME || 'Заметки'
const DEFAULT_DESC = 'Коллекция вечно-зелёных заметок.'

const titleBySlug = new Map(manifest.map(m => [m.slug, m.title] as const))

function htmlToText(html: string): string {
    const noTags = html.replace(/<[^>]+>/g, ' ')
    return noTags
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim()
}

function clamp160(s: string): string {
    return s.length > 160 ? s.slice(0, 157) + '…' : s
}

function buildDescription(slug: string | null | undefined): string {
    if (!slug) return DEFAULT_DESC

    // 1) приоритет: frontmatter.description
    const fm = graph.descriptionsBySlug?.[slug]
    if (fm && fm.trim()) return clamp160(fm.trim())

    // 2) фолбэк: сниппет (первые абзацы контента)
    const html = graph.excerptsBySlug?.[slug] || ''
    const text = htmlToText(html)
    if (text) return clamp160(text)

    return DEFAULT_DESC
}

function upsertMeta(selectorKey: 'name' | 'property', key: string, content: string) {
    let el = document.head.querySelector<HTMLMetaElement>(`meta[${selectorKey}="${key}"]`)
    if (!el) {
        el = document.createElement('meta')
        el.setAttribute(selectorKey, key)
        document.head.appendChild(el)
    }
    el.setAttribute('content', content)
}

function upsertLink(rel: string, href: string) {
    let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
    if (!el) {
        el = document.createElement('link')
        el.setAttribute('rel', rel)
        document.head.appendChild(el)
    }
    el.setAttribute('href', href)
}

function canonicalHrefFor(slug: string | null | undefined, indexSlug?: string): string {
    const base = import.meta.env.BASE_URL || '/'
    const path = !slug || (indexSlug && slug === indexSlug) ? '' : slug
    const baseNorm = base.endsWith('/') ? base : base + '/'
    return new URL(baseNorm + path, window.location.origin).toString()
}

/**
 * Обновляет <title>, meta description, canonical и OG-теги
 * из title/frontmatter.description/сниппета.
 */
export function updateSEO(activeSlug: string | null | undefined, indexSlug?: string) {
    const noteTitle = (activeSlug && titleBySlug.get(activeSlug)) || null
    const title = noteTitle ? `${noteTitle} — ${SITE_NAME}` : SITE_NAME
    const desc = buildDescription(activeSlug)
    const canon = canonicalHrefFor(activeSlug, indexSlug)

    document.title = title
    upsertMeta('name', 'description', desc)

    // Open Graph (минимум)
    upsertMeta('property', 'og:type', 'website')
    upsertMeta('property', 'og:title', title)
    upsertMeta('property', 'og:description', desc)
    upsertMeta('property', 'og:url', canon)

    // Canonical
    upsertLink('canonical', canon)
}
