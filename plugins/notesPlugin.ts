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
const V_CHECK = 'virtual:notes-check'
const R_MANIFEST = '\0' + V_MANIFEST
const R_GRAPH = '\0' + V_GRAPH
const R_CHECK = '\0' + V_CHECK

function toSlug(name: string) {
    return slugify(name, { lower: true, strict: true, locale: 'ru' })
}

export default function notesPlugin(): Plugin {
    let projectRoot = process.cwd()
    let notesDirAbs = path.resolve(projectRoot, 'notes')
    let outDir = 'dist'
    const failOnBroken = process.env.VITE_NOTES_FAIL_ON_BROKEN === 'true' || process.env.CI === 'true'

    type ManifestItem = { slug: string; title: string; path: string }

    let cached:
        | {
        manifest: ManifestItem[]
        outgoing: Record<string, string[]>
        incoming: Record<string, string[]>
        aliasMap: Record<string, string>
        aliasesBySlug: Record<string, string[]>
        aliasToSlugs: Record<string, string[]>
        excerptsBySlug: Record<string, string>
        brokenLinks: { fromSlug: string; fromTitle: string; target: string; targetSlug: string }[]
        aliasConflicts: { alias: string; slugs: string[] }[]
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

        // ── 1) Собираем мета из md ──────────────────────────────────────────────
        for (const rel of files) {
            const abs = path.join(notesDirAbs, rel)
            const raw = await fs.readFile(abs, 'utf8')
            const parsed = matter(raw)

            const fileBase = path.basename(rel, '.md')
            const fm = parsed.data ?? {}

            const title =
                typeof fm.title === 'string' && fm.title.trim()
                    ? fm.title.trim()
                    : fileBase

            const aliases: string[] = Array.isArray(fm.aliases)
                ? fm.aliases.map((s: any) => String(s).trim()).filter(Boolean)
                : typeof fm.aliases === 'string'
                    ? [fm.aliases.trim()].filter(Boolean)
                    : []

            const desiredSlugRaw =
                (typeof fm.slug === 'string' && fm.slug) ||
                (typeof fm.url === 'string' && fm.url) ||
                (typeof fm.permalink === 'string' && fm.permalink) ||
                null
            const desiredSlug = desiredSlugRaw ? toSlug(desiredSlugRaw) : null

            metasRaw.push({ rel, title, aliases, fileBase, desiredSlug })
        }

        // ── 2) Финальные slug'и + aliasMap ──────────────────────────────────────
        const used = new Map<string, number>()
        const manifest: ManifestItem[] = []
        const finalSlugs = new Set<string>()
        const aliasMap: Record<string, string> = {}
        const aliasesBySlug: Record<string, string[]> = {}
        const fileBaseBySlug: Record<string, string> = {} // 👈 для построения aliasToSlugs с учётом имени файла

        function ensureUnique(base: string): string {
            const n = (used.get(base) ?? 0) + 1
            used.set(base, n)
            return n === 1 ? base : `${base}-${n}`
        }

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
            fileBaseBySlug[slug] = m.fileBase // 👈 сохраним исходное имя файла

            // alias → canonSlug
            for (const a of m.aliases) {
                const aslug = toSlug(a)
                if (aslug) aliasMap[aslug] = slug
            }
            // title/fileBase → canonSlug (чтобы [[Заголовок]]/[[Имя файла]] работали)
            const titleSlug = toSlug(m.title)
            if (titleSlug) aliasMap[titleSlug] = slug
            const fileSlug = toSlug(m.fileBase)
            if (fileSlug) aliasMap[fileSlug] = slug
            // ручной desiredSlug тоже мапим на себя (удобно для ссылок по нему)
            if (m.desiredSlug) aliasMap[m.desiredSlug] = slug
        }

        // ── 3) markdown-it: wikilinks + excerpts/outgoing ───────────────────────
        const md = new MarkdownIt({ html: false, linkify: true, typographer: true })

        // env.outgoing / env.unresolved
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
                if (state.src.charCodeAt(pos) === 0x5d && pos + 1 < max && state.src.charCodeAt(pos + 1) === 0x5d) break
                pos++
            }
            if (pos >= max) return false

            if (!silent) {
                const raw = state.src.slice(start + 2, pos).trim()
                const pipe = raw.indexOf('|')
                const target = (pipe !== -1 ? raw.slice(0, pipe) : raw).trim()
                const cand = toSlug(target)
                const resolved = aliasMap[cand] ?? cand
                const env = state.env as any
                if (finalSlugs.has(resolved)) {
                    (env.outgoing ||= []).push(resolved)
                } else {
                    (env.unresolved ||= []).push({ raw: target, targetSlug: cand })
                }
            }

            state.pos = pos + 2
            return true
        }
        md.inline.ruler.before('emphasis', 'wikilinks-build', wikiLinksBuild)

        function buildExcerpt(markdown: string, paras = 2): string {
            const noMdImages = markdown.replace(/!\[[^\]]*]\([^)]*\)/g, '')
            const blocks = noMdImages.trim().split(/\n\s*\n+/).slice(0, paras).join('\n\n')
            return md.render(blocks)
        }

        const outgoingMap = new Map<string, Set<string>>()
        const excerptsBySlug: Record<string, string> = {}
        const unresolvedBySlug: Record<string, { raw: string; targetSlug: string }[]> = {}

        for (const m of manifest) {
            const abs = path.join(projectRoot, m.path.slice(1))
            const raw = await fs.readFile(abs, 'utf8')
            const parsed = matter(raw)

            excerptsBySlug[m.slug] = buildExcerpt(parsed.content, 2)

            const env: any = { outgoing: [] as string[], unresolved: [] as any[] }
            md.render(parsed.content, env)
            outgoingMap.set(m.slug, new Set(env.outgoing))
            if (env.unresolved.length) unresolvedBySlug[m.slug] = env.unresolved
        }

        const outgoing: Record<string, string[]> = {}
        const incoming: Record<string, string[]> = {}
        for (const [src, set] of outgoingMap.entries()) {
            outgoing[src] = Array.from(set)
            for (const dst of set) (incoming[dst] ||= []).push(src)
        }
        for (const k of Object.keys(incoming)) incoming[k].sort()

        // ── 4) aliasToSlugs + конфликты (title + fileBase + aliases) ───────────
        const aliasToSlugs: Record<string, string[]> = {}

        for (const m of manifest) {
            const keys = new Set<string>()
            const titleKey = toSlug(m.title)
            if (titleKey) keys.add(titleKey)
            const fileKey = toSlug(fileBaseBySlug[m.slug] || '')
            if (fileKey) keys.add(fileKey)
            const al = aliasesBySlug[m.slug] || []
            for (const a of al) {
                const k = toSlug(a)
                if (k) keys.add(k)
            }
            for (const k of keys) (aliasToSlugs[k] ||= []).push(m.slug)
        }

        const aliasConflicts = Object.entries(aliasToSlugs)
            .filter(([, sl]) => sl.length > 1)
            .map(([alias, slugs]) => ({ alias, slugs }))

        // нерешённые ссылки
        const brokenLinks: { fromSlug: string; fromTitle: string; target: string; targetSlug: string }[] = []
        for (const [fromSlug, list] of Object.entries(unresolvedBySlug)) {
            const fromTitle = manifest.find(m => m.slug === fromSlug)?.title ?? fromSlug
            for (const u of list) brokenLinks.push({ fromSlug, fromTitle, target: u.raw, targetSlug: u.targetSlug })
        }

        cached = {
            manifest,
            outgoing,
            incoming,
            aliasMap,
            aliasesBySlug,
            aliasToSlugs,
            excerptsBySlug,
            brokenLinks,
            aliasConflicts,
        }
        return cached
    }

    function logReport(rep: Awaited<ReturnType<typeof buildData>>) {
        const { brokenLinks, aliasConflicts } = rep
        if (aliasConflicts.length) {
            console.warn(`\n[notes] ambiguous aliases (${aliasConflicts.length}):`)
            for (const a of aliasConflicts) {
                console.warn(`  ? "${a.alias}" → [${a.slugs.join(', ')}]`)
            }
        }
        if (brokenLinks.length) {
            console.warn(`\n[notes] broken wikilinks (${brokenLinks.length}):`)
            for (const b of brokenLinks) {
                console.warn(`  ${b.fromTitle} [[${b.target}]]  (→ "${b.targetSlug}")`)
            }
        }
        if (!brokenLinks.length && !aliasConflicts.length) {
            console.log('[notes] link graph: OK')
        }
    }

    async function writeJsonReport(rep: Awaited<ReturnType<typeof buildData>>) {
        const json = JSON.stringify({ brokenLinks: rep.brokenLinks, aliasConflicts: rep.aliasConflicts }, null, 2)
        const file = path.join(projectRoot, 'notes-check.json')
        try { await fs.writeFile(file, json, 'utf8') } catch {}
    }

    // Dev HMR: если меняются .md — чистим кэш
    function maybeInvalidate(ctx: HmrContext) {
        const file = ctx.file.replace(/\\/g, '/')
        if (file.includes('/notes/') && file.endsWith('.md')) {
            cached = null
            for (const id of [R_MANIFEST, R_GRAPH, R_CHECK]) {
                const mod = ctx.server.moduleGraph.getModuleById(id)
                if (mod) ctx.server.moduleGraph.invalidateModule(mod)
            }
        }
    }

    return {
        name: 'notes-plugin',
        enforce: 'pre',

        configResolved(cfg: ResolvedConfig) {
            projectRoot = cfg.root || process.cwd()
            notesDirAbs = path.resolve(projectRoot, 'notes')
            outDir = (cfg.build?.outDir as string) || 'dist'
        },

        resolveId(id) {
            if (id === V_MANIFEST) return R_MANIFEST
            if (id === V_GRAPH) return R_GRAPH
            if (id === V_CHECK) return R_CHECK
            return null
        },

        async load(id) {
            if (id === R_MANIFEST) {
                const { manifest } = await buildData()
                return `export default ${JSON.stringify(manifest)}`
            }
            if (id === R_GRAPH) {
                const { outgoing, incoming, aliasMap, aliasesBySlug, aliasToSlugs, excerptsBySlug } = await buildData()
                return `export default ${JSON.stringify({ outgoing, incoming, aliasMap, aliasesBySlug, aliasToSlugs, excerptsBySlug })}`
            }
            if (id === R_CHECK) {
                const { brokenLinks, aliasConflicts } = await buildData()
                return `export default ${JSON.stringify({ brokenLinks, aliasConflicts })}`
            }
            return null
        },

        async handleHotUpdate(ctx) {
            maybeInvalidate(ctx)
        },

        async buildStart() {
            const rep = await buildData()
            logReport(rep)
            // не падаем на buildStart — дадим собрать бандл, но уже предупредим
        },

        async closeBundle() {
            const rep = await buildData()
            await writeJsonReport(rep)
            if (failOnBroken && (rep.brokenLinks.length || rep.aliasConflicts.length)) {
                throw new Error(`[notes] build failed: broken=${rep.brokenLinks.length}, ambiguous=${rep.aliasConflicts.length}`)
            }
        },
    }
}
