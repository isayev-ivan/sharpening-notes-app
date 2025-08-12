// plugins/notesPlugin.ts
import fs from 'node:fs/promises'
import path from 'node:path'
import fg from 'fast-glob'
import matter from 'gray-matter'
import MarkdownIt from 'markdown-it'
import slugify from 'slugify'
import type { Plugin, ResolvedConfig, HmrContext } from 'vite'

const V_MANIFEST = 'virtual:notes-manifest'
const V_GRAPH = 'virtual:notes-graph'
const R_MANIFEST = '\0' + V_MANIFEST
const R_GRAPH = '\0' + V_GRAPH

function toSlug(name: string) {
    return slugify(name, { lower: true, strict: true, locale: 'ru' })
}

export default function notesPlugin(): Plugin {
    let projectRoot: string = process.cwd()
    let notesDirAbs: string = path.resolve(projectRoot, 'notes')

    type ManifestItem = { slug: string; title: string; path: string }

    let cached:
        | {
        manifest: ManifestItem[]
        outgoing: Record<string, string[]>
        incoming: Record<string, string[]>
        aliasMap: Record<string, string>
        aliasesBySlug: Record<string, string[]>
        excerptsBySlug: Record<string, string>
    }
        | null = null

    async function buildData() {
        if (cached) return cached

        notesDirAbs = path.resolve(projectRoot, 'notes')
        const files = await fg('**/*.md', { cwd: notesDirAbs, dot: false })

        type RawMeta = { rel: string; title: string; aliases: string[]; baseSlug: string }
        const metasRaw: RawMeta[] = []

        for (const rel of files) {
            const abs = path.join(notesDirAbs, rel)
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
                rel,
                title,
                aliases,
                baseSlug: toSlug(title || fileName),
            })
        }

        // финальные слаги (уникализируем дубликаты)
        const slugCount = new Map<string, number>()
        const manifest: ManifestItem[] = []
        const finalSlugs = new Set<string>()
        const aliasMap: Record<string, string> = {}
        const aliasesBySlug: Record<string, string[]> = {}

        for (const m of metasRaw) {
            const n = (slugCount.get(m.baseSlug) ?? 0) + 1
            slugCount.set(m.baseSlug, n)
            const slug = n === 1 ? m.baseSlug : `${m.baseSlug}-${n}`

            manifest.push({
                slug,
                title: m.title,
                path: '/notes/' + m.rel.replace(/\\/g, '/'),
            })
            finalSlugs.add(slug)
            aliasesBySlug[slug] = m.aliases.slice()

            for (const a of m.aliases) {
                const aslug = toSlug(a)
                if (aslug && aslug !== slug) aliasMap[aslug] = slug
            }
        }

        // markdown-it для построения outgoing и сниппетов
        const md = new MarkdownIt({ html: false, linkify: true, typographer: true })

        // inline-правило вики-ссылок [[Title]] или [[Title | label]]
        const wikiLinksBuild = (state: any, silent: boolean) => {
            const start = state.pos
            const max = state.posMax
            if (
                state.src.charCodeAt(start) !== 0x5b || // [
                start + 1 >= max ||
                state.src.charCodeAt(start + 1) !== 0x5b // [
            ) return false

            let pos = start + 2
            while (pos < max) {
                if (state.src.charCodeAt(pos) === 0x5d && pos + 1 < max && state.src.charCodeAt(pos + 1) === 0x5d) break // ]]
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
                if (finalSlugs.has(slug)) {
                    (env.outgoing ||= []).push(slug)
                }
            }

            state.pos = pos + 2
            return true
        }
        md.inline.ruler.before('emphasis', 'wikilinks-build', wikiLinksBuild)

        // сниппет: первые N абзацев, без markdown-изображений
        function buildExcerpt(markdown: string, paras = 2): string {
            const noMdImages = markdown.replace(/!\[[^\]]*]\([^)]*\)/g, '')
            const blocks = noMdImages.trim().split(/\n\s*\n+/).slice(0, paras).join('\n\n')
            return md.render(blocks)
        }

        // собираем outgoing и excerpts
        const outgoingMap = new Map<string, Set<string>>()
        const excerptsBySlug: Record<string, string> = {}

        for (const m of manifest) {
            const abs = path.join(projectRoot, m.path.slice(1)) // '/notes/x.md' → '<root>/notes/x.md'
            const raw = await fs.readFile(abs, 'utf8')
            const parsed = matter(raw)

            // excerpt
            excerptsBySlug[m.slug] = buildExcerpt(parsed.content, 2)

            // outgoing
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

        cached = { manifest, outgoing, incoming, aliasMap, aliasesBySlug, excerptsBySlug }
        return cached
    }

    // Удобная инвалидация в dev при изменении markdown-файлов
    function maybeInvalidate(ctx: HmrContext) {
        const file = ctx.file.replace(/\\/g, '/')
        if (file.includes('/notes/') && file.endsWith('.md')) {
            cached = null
            // Инвалидируем виртуальные модули
            const mod1 = ctx.server.moduleGraph.getModuleById(R_MANIFEST)
            const mod2 = ctx.server.moduleGraph.getModuleById(R_GRAPH)
            if (mod1) ctx.server.moduleGraph.invalidateModule(mod1)
            if (mod2) ctx.server.moduleGraph.invalidateModule(mod2)
        }
    }

    return {
        name: 'notes-plugin',
        enforce: 'pre',

        configResolved(cfg: ResolvedConfig) {
            projectRoot = cfg.root || process.cwd()
            notesDirAbs = path.resolve(projectRoot, 'notes')
        },

        resolveId(id: string) {
            if (id === V_MANIFEST) return R_MANIFEST
            if (id === V_GRAPH) return R_GRAPH
            return null
        },

        async load(id: string) {
            if (id === R_MANIFEST) {
                const { manifest } = await buildData()
                return `export default ${JSON.stringify(manifest)}`
            }
            if (id === R_GRAPH) {
                const { outgoing, incoming, aliasMap, aliasesBySlug, excerptsBySlug } = await buildData()
                return `export default ${JSON.stringify({ outgoing, incoming, aliasMap, aliasesBySlug, excerptsBySlug })}`
            }
            return null
        },

        async handleHotUpdate(ctx) {
            maybeInvalidate(ctx)
        },
    }
}
