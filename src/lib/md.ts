import MarkdownIt from 'markdown-it'
import { wikiLinksPlugin, type WikiLinksOptions } from './wikiLinks'
import manifest from 'virtual:notes-manifest'
import graph from 'virtual:notes-graph'
import { toSlug } from '@/lib/slug'

const validSlugs = new Set(manifest.map(m => m.slug))
const titleBySlug = new Map(manifest.map(m => [m.slug, m.title] as const))

const opts: WikiLinksOptions = {
    resolve(name: string): string | null {
        const key = toSlug(name)
        const resolved = graph.aliasMap?.[key] ?? key
        return validSlugs.has(resolved) ? resolved : null
    },
    isAmbiguous(name: string): boolean {
        const key = toSlug(name)
        const arr = graph.aliasToSlugs?.[key] ?? []
        return arr.length > 1
    },
    // ⬇️ текст для тултипа: до 6 совпадений, многострочно
    getAmbiguityList(name: string): string {
        const key = toSlug(name)
        const slugs = graph.aliasToSlugs?.[key] ?? []
        if (slugs.length <= 1) return ''
        const items = slugs.slice(0, 6).map(s => `• ${titleBySlug.get(s) ?? s}  (/` + s + ')')
        return `Несколько заметок с алиасом «${name}»:\n` + items.join('\n')
    },
}

export const md = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: true,
})

md.use(wikiLinksPlugin, opts)

/**
 * Рендерит первые N абзацев, удаляя изображения.
 */
export function renderPreview(content: string, maxParagraphs = 3): string {
    const env: any = {}
    const tokens = md.parse(content, env)

    const out: any[] = []
    let paragraphs = 0
    let inPara = false

    for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i]

        if (t.type === 'paragraph_open') {
            if (paragraphs >= maxParagraphs) break
            inPara = true
            out.push(t)
            continue
        }
        if (t.type === 'paragraph_close') {
            inPara = false
            paragraphs++
            out.push(t)
            if (paragraphs >= maxParagraphs) break
            continue
        }

        if (inPara) {
            if (t.type === 'inline') {
                const clone = new (t as any).constructor()
                Object.assign(clone, t)
                clone.children = (t.children || []).filter((c: any) => c.type !== 'image')
                out.push(clone)
            } else if (t.type !== 'image') {
                out.push(t)
            }
        }
    }

    return md.renderer.render(out as any, md.options, env)
}
