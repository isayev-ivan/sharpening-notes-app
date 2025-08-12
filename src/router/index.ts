import { createRouter, createWebHistory, RouteRecordRaw, RouteLocationNormalizedLoaded } from 'vue-router'
import NoteView from '@/components/NoteView.vue'

const routes: RouteRecordRaw[] = [
    // корень сайта — «домашняя» колонка (index.md)
    { name: 'root', path: '/', component: NoteView },
    // любое число слугов через слэш: /slug1[/slug2[/...]]
    { name: 'columns', path: '/:slugs(.*)*', component: NoteView },
]

const router = createRouter({
    // важен base — Vite подставит '/repo-name/' на GitHub Pages
    history: createWebHistory(import.meta.env.BASE_URL),
    routes,
    scrollBehavior() { return { left: 0, top: 0 } }
})

export default router

// helpers
export function slugsFromRoute(route: RouteLocationNormalizedLoaded): string[] {
    const p = route.params.slugs as string | string[] | undefined
    if (!p) return []
    return Array.isArray(p) ? p.filter(Boolean) : [p].filter(Boolean)
}

export function routeLocationForSlugs(slugs: string[], indexSlug?: string) {
    // если пуста или открыта только index.md — остаёмся на корне '/'
    if (slugs.length === 0 || (indexSlug && slugs.length === 1 && slugs[0] === indexSlug)) {
        return { name: 'root' }
    }
    return { name: 'columns', params: { slugs } }
}
