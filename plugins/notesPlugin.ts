import fs from 'node:fs/promises'
import path from 'node:path'
import fg from 'fast-glob'
import matter from 'gray-matter'
import MarkdownIt from 'markdown-it'
import slugify from 'slugify'
import type { Plugin } from 'vite'

const V_MANIFEST = 'virtual:notes-manifest'
const V_GRAPH = 'virtual:notes-graph'
const R_MANIFEST = '\0' + V_MANIFEST
const R_GRAPH = '\0' + V_GRAPH

function toSlug(name: string) {
    return slugify(name, { lower: true, strict: true, locale: 'ru' })
}

export default function notesPlugin(): Plugin {
    // ✅ объявляем переменную в замыкании плагина
    let projectRoot: string = process.cwd()

    let cached:
        | {
        manifest: { slug: string; title: string; path: string }[]
        outgoing: Record<string, string[]>
        incoming: Record<string, string[]>
        aliasMap: Record<string, string>
    }
        | null = null

    async function buildData() {
        if (cached) return cached

        // ✅ используем projectRoot
        const notesDir = path.resolve(projectRoot, 'notes')
        const files = await fg('**/*.md', { cwd: notesDir, dot: false })

        type Raw = { path: string; title: string; baseSlug: string; aliases: string[] }
        const metasRaw: Raw[] = []

        for (const rel of files) {
            const abs = path.join(notesDir, rel)
            const raw = await fs.readFile(abs, 'utf8')
            const parsed = matter(raw)
            const fileName = path.basename(rel, '.md')
            const title =
                typeof parsed.data?.title === 'string' && parsed.data.title.trim()
                    ? parsed.data.title.trim()
                    : fileName

            const aliases: string[] = Array.isArray(parsed.data?.aliases)
                ? parsed.data.aliases.map((s: any) => String(s).trim()).filter(Boolean)
                : []

            metasRaw.push({
                path: '/notes/' + rel.replace(/\\/g, '/'),
                title,
                baseSlug: toSlug(title || fileName),
                aliases,
            })
        }

        const slugCount = new Map<string, number>()
        const manifest: { slug: string; title: string; path: string }[] = []
        const finalSlugs = new Set<string>()
        const aliasMap: Record<string, string> = {}

        for (const m of metasRaw) {
            const count = (slugCount.get(m.baseSlug) ?? 0) + 1
            slugCount.set(m.baseSlug, count)
            const slug = count === 1 ? m.baseSlug : `${m.baseSlug}-${count}`
            manifest.push({ slug, title: m.title, path: m.path })
            finalSlugs.add(slug)

            for (const a of m.aliases) {
                const aslug = toSlug(a)
                if (aslug && aslug !== slug) aliasMap[aslug] = slug
            }
        }

        const md = new MarkdownIt({ html: false, linkify: true, typographer: true })
        md.inline.ruler.before('emphasis', 'wikilinks-build', (state, silent) => {
            const start = state.pos, max = state.posMax
            if (state.src.charCodeAt(start) !== 0x5B || start + 1 >= max || state.src.charCodeAt(start + 1) !== 0x5B) return false
            let pos = start + 2
            while (pos < max) {
                if (state.src.charCodeAt(pos) === 0x5D && pos + 1 < max && state.src.charCodeAt(pos + 1) === 0x5D) break
                pos++
            }
            if (pos >= max) return false
            if (!silent) {
                const raw = state.src.slice(start + 2, pos).trim()
                const pipe = raw.indexOf('|')
                const target = (pipe !== -1 ? raw.slice(0, pipe) : raw).trim()
                let slug = toSlug(target)
                if (aliasMap[slug]) slug = aliasMap[slug]
                const env = state.env as any
                if (finalSlugs.has(slug)) (env.outgoing ||= []).push(slug)
            }
            state.pos = pos + 2
            return true
        })

        const outgoingMap = new Map<string, Set<string>>()
        for (const m of manifest) {
            // ✅ тоже на основе projectRoot
            const abs = path.join(projectRoot, m.path.slice(1))
            const raw = await fs.readFile(abs, 'utf8')
            const parsed = matter(raw)
            const env: any = { outgoing: [] as string[] }
            md.render(parsed.content, env)
            outgoingMap.set(m.slug, new Set(env.outgoing))
        }

        const outgoing: Record<string, string[]> = {}
        const incoming: Record<string, string[]> = {}
        for (const [src, set] of outgoingMap.entries()) {
            outgoing[src] = Array.from(set)
            for (const dst of set) (incoming[dst] ||= []).push(src)
        }
        for (const k of Object.keys(incoming)) incoming[k].sort()

        cached = { manifest, outgoing, incoming, aliasMap }
        return cached
    }

    return {
        name: 'notes-plugin',
        enforce: 'pre',
        configResolved(cfg) {
            // ✅ сохраняем корень проекта из Vite
            projectRoot = (cfg as any).root || process.cwd()
        },
        resolveId(id) {
            if (id === V_MANIFEST) return R_MANIFEST
            if (id === V_GRAPH) return R_GRAPH
            return null
        },
        async load(id) {
            if (id === R_MANIFEST) {
                const { manifest } = await buildData()
                return `export default ${JSON.stringify(manifest)}`
            }
            if (id === R_GRAPH) {
                const { outgoing, incoming, aliasMap } = await buildData()
                return `export default ${JSON.stringify({ outgoing, incoming, aliasMap })}`
            }
            return null
        },
    }
}
