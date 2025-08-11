import { defineStore } from 'pinia'

export type Column = { slug: string; scrollTop: number }

export const useColumnsStore = defineStore('columns', {
    state: () => ({
        columns: [] as Column[],
    }),
    actions: {
        openRight(slug: string) {
            this.columns.push({ slug, scrollTop: 0 })
        },
        replaceFrom(index: number, slug: string) {
            this.columns = this.columns.slice(0, index)
            this.columns.push({ slug, scrollTop: 0 })
        },
        openToRightOf(index: number, slug: string) {
            this.columns = this.columns.slice(0, index + 1)
            this.columns.push({ slug, scrollTop: 0 })
        },
        closeAt(index: number) {
            this.columns.splice(index, 1)
        },
        ensureAtLeastOne() {
            if (this.columns.length === 0) {
                this.columns.push({ slug: 'home', scrollTop: 0 }) // временный плейсхолдер
            }
        },
        setSlugAt(index: number, slug: string) {
            if (this.columns[index]) this.columns[index].slug = slug
        },
        // NEW: полная замена колонок по списку слугов
        setColumns(slugs: string[]) {
            this.columns = slugs.map(s => ({ slug: s, scrollTop: 0 }))
        },
    },
    getters: {
        slugs(state): string[] {
            return state.columns.map(c => c.slug)
        }
    }
})
