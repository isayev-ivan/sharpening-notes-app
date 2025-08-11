import manifest from 'virtual:notes-manifest'
import graph from 'virtual:notes-graph'            // 👈 получим aliasMap
import { toSlug } from './slug'

export type NoteMeta = { slug: string; title: string; path: string }
export type NoteDoc = NoteMeta & { content: string }

const metas: NoteMeta[] = manifest
const slugToPath = new Map<string, string>(metas.map(m => [m.slug, m.path]))
const aliasMap = graph.aliasMap || {}              // 👈

const rawFiles = import.meta.glob('/notes/**/*.md', { as: 'raw' }) as Record<string, () => Promise<string>>

function stripFrontmatter(raw: string): string {
    if (raw.startsWith('---')) {
        const end = raw.indexOf('\n---', 3)
        if (end !== -1) return raw.slice(end + 4).replace(/^\s*\n/, '')
    }
    return raw
}

export async function getManifest(): Promise<NoteMeta[]> { return metas }

export async function loadNoteBySlug(slug: string): Promise<NoteDoc | null> {
    const path = slugToPath.get(slug)
    if (!path) return null
    const raw = await rawFiles[path]()
    const content = stripFrontmatter(raw)
    const meta = metas.find(m => m.slug === slug)!
    return { ...meta, content }
}

export function findSlugByName(name: string): string | null {
    const s = toSlug(name)
    if (slugToPath.has(s)) return s
    const canonical = aliasMap[s]
    return canonical && slugToPath.has(canonical) ? canonical : null
}
