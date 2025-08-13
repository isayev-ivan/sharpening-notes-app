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

// Нормализация → slug (локаль ru для кириллицы)
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

        type RawMeta = {
            rel: string
            title: string
            aliases: string[]
            fileBase: string
            desiredSlug?: string | null
        }
        const metasRaw: RawMeta[] = []

        // 1) Собираем метаданные
        for (const rel of files) {
            const abs = path.join(notesDirAbs, rel)
            const raw = await fs.readFile(abs, 'utf8')
            const parsed = matter(raw)

            const fileBase = path.basename(rel, '.md') // может быть кириллицей
            const fm = parsed.data ?? {}

            const title =
                typeof fm.title === 'string' && fm.title.trim()
                    ? fm.title.trim()
                    : fileBase

            // aliases: строка | массив строк
            const aliases: string[] = Array.isArray(fm.aliases)
                ? fm.aliases.map((s: any) => String(s).trim()).filter(Boolean)
                : typeof fm.aliases === 'string'
                    ? [fm.aliases.trim()].filter(Boolean)
                    : []

            // желаемый URL-слизок: slug | url | permalink
            const desiredSlugRaw =
                (typeof fm.slug === 'string' && fm.slug) ||
                (typeof fm.url === 'string' && fm.url) ||
                (typeof fm.permalink === 'string' && fm.permalink) ||
                null
            const desiredSlug = desiredSlugRaw ? toSlug(desiredSlugRaw) : null

            metasRaw.push({ rel, title, aliases, fileBase, desiredSlug })
        }

        // 2) Финальные slug'и (уникализация + alias map)
        const used = new Map<string, number>()
        const manifest: ManifestItem[] = []
        const finalSlugs = new Set<string>()

        const aliasMap: Record<string, string> = {}
        const aliasesBySlug: Record<string, string[]> = {}

        function ensureUnique(base: string): string {
            const n = (used.get(base) ?? 0) + 1
            used.set(base, n)
            return n === 1 ? base : `${base}-${n}`
        }

        // предварительный проход — чтобы иметь доступ к каноническим slug'ам
        for (const m of metasRaw) {
            const autoBase = toSlug(m.title || m.fileBase)
            const base = m.desiredSlug ?? autoBase
            const slug = ensureUnique(base)

            manifest.push({
                slug,
                title: m.title,
                path: '/notes/' + m.rel.replace(/\\/g, '/'),
            })
            finalSlugs.add(slug)
            aliasesBySlug[slug] = m.aliases.slice()

            // Маппинги для вики-ссылок:
            //  - алиасы → канонический slug
            for (const a of m.aliases) {
                const aslug = toSlug(a)
                if (aslug && aslug !== slug) aliasMap[aslug] = slug
            }
            //  - сам заголовок → канонический slug (если override изменил slug)
            const titleSlug = toSlug(m.title)
            if (titleSlug && titleSlug !== slug) aliasMap[titleSlug] = slug
            //  - имя файла → канонический slug (удобно, если ссылались по имени)
            const fileSlug = toSlug(m.fileBase)
            if (fileSlug && fileSlug !== slug) aliasMap[fileSlug] = slug
            //  - если переопределили slug вручную, берём и его (на всякий)
            if (m.desiredSlug && m.desiredSlug !== slug) aliasMap[m.desiredSlug] = slug
        }

        // 3) markdown-it для outgoing и сниппетов
        const md = new MarkdownIt({ html: false, linkify: true, typographer: true })

        // inline-правило: собираем вики-ссылки [[Заголовок]] / [[Заголовок | текст]]
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
                let s = toSlug(target) // нормализуем кириллицу → slug
                if (aliasMap[s]) s = aliasMap[s] // маппинг алиасов/заголовков/имён файлов → кан. slug
                const env = state.env as any
                if (finalSlugs.has(s)) (env.outgoing ||= []).push(s)
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

        // 4) outgoing + excerpts
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

    // Инвалидация в dev при изменении markdown-файлов
    function maybeInvalidate(ctx: HmrContext) {
        const file = ctx.file.replace(/\\/g, '/')
        if (file.includes('/notes/') && file.endsWith('.md')) {
            cached = null
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
