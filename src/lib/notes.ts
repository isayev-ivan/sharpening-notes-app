import matter from 'gray-matter'
import { toSlug } from './slug'

export type NoteMeta = {
    slug: string
    title: string
    path: string
}

export type NoteDoc = NoteMeta & {
    content: string
}

const files = import.meta.glob('/notes/**/*.md', { as: 'raw' }) as Record<string, () => Promise<string>>

// Хранилища
const slugToPath = new Map<string, string>()
let manifestPromise: Promise<NoteMeta[]> | null = null

async function buildManifest(): Promise<NoteMeta[]> {
    const entries = Object.entries(files)
    const metas: NoteMeta[] = []

    // Парсим все заметки (для получения title/slug). Контент пока никуда не рендерим.
    await Promise.all(entries.map(async ([path, loader]) => {
        const raw = await loader()
        const parsed = matter(raw)
        const fileName = path.split('/').pop()!.replace(/\.md$/, '')
        const title = (typeof parsed.data?.title === 'string' && parsed.data.title.trim()) ? parsed.data.title.trim() : fileName
        const slug = toSlug(title || fileName)
        metas.push({ slug, title, path })
        slugToPath.set(slug, path)
    }))

    // Уникальность slug'ов на случай коллизий
    const seen = new Set<string>()
    for (const m of metas) {
        if (seen.has(m.slug)) {
            // простой разруливатель (добавить числовой суффикс)
            let i = 2
            let next = `${m.slug}-${i}`
            while (seen.has(next)) { i++; next = `${m.slug}-${i}` }
            m.slug = next
            slugToPath.set(m.slug, m.path)
        }
        seen.add(m.slug)
    }

    // Сортировка по заголовку для стабильности
    metas.sort((a, b) => a.title.localeCompare(b.title, 'ru'))
    return metas
}

export async function getManifest(): Promise<NoteMeta[]> {
    if (!manifestPromise) manifestPromise = buildManifest()
    return manifestPromise
}

export async function loadNoteBySlug(slug: string): Promise<NoteDoc | null> {
    if (!manifestPromise) await getManifest()

    const path = slugToPath.get(slug)
    if (!path) return null

    const raw = await files[path]()
    const parsed = matter(raw)
    const fileName = path.split('/').pop()!.replace(/\.md$/, '')
    const title = (typeof parsed.data?.title === 'string' && parsed.data.title.trim()) ? parsed.data.title.trim() : fileName

    return {
        slug,
        title,
        path,
        content: parsed.content,
    }
}

export function findSlugByName(name: string): string | null {
    const s = toSlug(name)
    return slugToPath.has(s) ? s : null
}
