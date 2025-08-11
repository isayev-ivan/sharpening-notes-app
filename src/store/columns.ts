import { defineStore } from 'pinia'

export type Column = { slug: string }

export const useColumnsStore = defineStore('columns', {
    state: () => ({
        columns: [] as Column[],
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
            if (c) delete this.scrollBySlug[c.slug] // можно оставить, чтобы не копить
            this.columns.splice(index, 1)
        },
        setColumns(slugs: string[]) { this.columns = slugs.map(s => ({ slug: s })) },

        setScrollForSlug(slug: string, top: number) { this.scrollBySlug[slug] = top },
        getScrollForSlug(slug: string) { return this.scrollBySlug[slug] },
    },
    getters: {
        slugs(state): string[] { return state.columns.map(c => c.slug) }
    }
})
