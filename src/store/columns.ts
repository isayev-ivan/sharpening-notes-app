import { defineStore } from 'pinia'
import { saveJSON, loadJSON } from '@/lib/storage'

export type Column = { slug: string }

// отдельно храним только скроллы по slug
const STORAGE_KEY = 'scrolls:v1'

export const useColumnsStore = defineStore('columns', {
    state: () => ({
        columns: [] as Column[],
        scrollBySlug: {} as Record<string, number>,
    }),
    getters: {
        slugs(state): string[] { return state.columns.map(c => c.slug) }
    },
    actions: {
        // --- CRUD колонок ---
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
            // ВАЖНО: не удаляем scrollBySlug — чтобы при следующем открытии восстановить позицию
            this.columns.splice(index, 1)
        },
        ensureAtLeastOne() { if (this.columns.length === 0) this.columns.push({ slug: 'home' }) },
        setSlugAt(index: number, slug: string) { if (this.columns[index]) this.columns[index].slug = slug },
        setColumns(slugs: string[]) { this.columns = slugs.map(s => ({ slug: s })) },

        // --- скролл по slug + persistence ---
        setScrollForSlug(slug: string, top: number) {
            this.scrollBySlug[slug] = top
            saveJSON(STORAGE_KEY, this.scrollBySlug)
        },
        getScrollForSlug(slug: string): number | undefined {
            return this.scrollBySlug[slug]
        },
        initFromStorage() {
            this.scrollBySlug = loadJSON<Record<string, number>>(STORAGE_KEY, {})
        },
    }
})
