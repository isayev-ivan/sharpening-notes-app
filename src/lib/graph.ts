import graph from 'virtual:notes-graph' // { outgoing, incoming }
import manifest from 'virtual:notes-manifest'
import type { NoteMeta } from './notes'

const metaBySlug = new Map<string, NoteMeta>(manifest.map(m => [m.slug, m]))

export async function getBacklinksFor(slug: string): Promise<NoteMeta[]> {
    const sources = graph.incoming[slug] ?? []
    const list = sources.map(s => metaBySlug.get(s)).filter(Boolean) as NoteMeta[]
    list.sort((a, b) => a.title.localeCompare(b.title, 'ru'))
    return list
}
