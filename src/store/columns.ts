import { defineStore } from 'pinia'

// раньше: { slug, scrollTop }
export type Column = { slug: string }

export const useColumnsStore = defineStore('columns', {
    state: () => ({
        columns: [] as Column[],
        // ключ — slug, значение — scrollTop
        scrollBySlug: {} as Record<string, number>,
    }),
    actions: {
        openRight(slug: string) { this.columns.push({ slug }) },
        replaceFrom(index: number, slug: string) {
            this.columns = this.columns.slice(0, index)
            this.columns.push({ slug })
        },
        openToRightOf(index: number, slug: string) {
            this.columns = this.columns.slice(0, index + 1)
            this.columns.push({ slug })
        },
        closeAt(index: number) {
            const c = this.columns[index]
            if (c) delete this.scrollBySlug[c.slug] // опционально чистим кеш
            this.columns.splice(index, 1)
        },
        ensureAtLeastOne() { if (this.columns.length === 0) this.columns.push({ slug: 'home' }) },
        setSlugAt(index: number, slug: string) { if (this.columns[index]) this.columns[index].slug = slug },
        setColumns(slugs: string[]) { this.columns = slugs.map(s => ({ slug: s })) },

        // 👇 новые методы
        setScrollForSlug(slug: string, top: number) { this.scrollBySlug[slug] = top },
        getScrollForSlug(slug: string): number | undefined { return this.scrollBySlug[slug] },
    },
    getters: {
        slugs(state): string[] { return state.columns.map(c => c.slug) }
    }
})
