import matter from 'gray-matter'
import { md } from './md'
import { getManifest, getResolvedSlugByPath, findSlugByName, type NoteMeta } from './notes'

const files = import.meta.glob('/notes/**/*.md', { as: 'raw' }) as Record<string, () => Promise<string>>

type Graph = {
    outgoing: Map<string, Set<string>>
    incoming: Map<string, Set<string>>
    metaBySlug: Map<string, NoteMeta>
}

let buildPromise: Promise<Graph> | null = null

export async function getGraph(): Promise<Graph> {
    if (buildPromise) return buildPromise
    buildPromise = (async () => {
        const manifest = await getManifest()
        const metaBySlug = new Map<string, NoteMeta>(manifest.map(m => [m.slug, m]))

        const outgoing = new Map<string, Set<string>>()
        const incoming = new Map<string, Set<string>>()

        const entries = Object.entries(files)
        await Promise.all(entries.map(async ([path, loader]) => {
            const raw = await loader()
            const parsed = matter(raw)

            const slug = await getResolvedSlugByPath(path)
            if (!slug) return // защитный

            const env: any = { resolve: findSlugByName, outgoing: [] as string[] }
            md.render(parsed.content, env)

            const uniq = new Set(env.outgoing as string[])
            outgoing.set(slug, uniq)
            for (const target of uniq) {
                if (!incoming.has(target)) incoming.set(target, new Set())
                incoming.get(target)!.add(slug)
            }
        }))

        return { outgoing, incoming, metaBySlug }
    })()
    return buildPromise
}

export async function getBacklinksFor(slug: string): Promise<NoteMeta[]> {
    const g = await getGraph()
    const set = g.incoming.get(slug)
    if (!set || set.size === 0) return []
    const list = Array.from(set)
        .map(s => g.metaBySlug.get(s))
        .filter(Boolean) as NoteMeta[]
    // Сортируем по заголовку для стабильности
    list.sort((a, b) => a.title.localeCompare(b.title, 'ru'))
    return list
}
