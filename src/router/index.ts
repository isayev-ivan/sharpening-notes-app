import { createRouter, createWebHashHistory, RouteRecordRaw, RouteLocationNormalizedLoaded } from 'vue-router'
import NoteView from '@/components/NoteView.vue'

const routes: RouteRecordRaw[] = [
    { path: '/', redirect: '/n' },
    // было: /n/:slugs(.*)?
    // стало: повторяемый параметр, 0+ сегментов
    { name: 'columns', path: '/n/:slugs*', component: NoteView },
]

const router = createRouter({
    history: createWebHashHistory(),
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

export function routeLocationForSlugs(slugs: string[]) {
    // ВАЖНО: передаём массив, а не строку
    return { name: 'columns', params: { slugs } }
}
