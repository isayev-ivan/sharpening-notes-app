import { createRouter, createWebHashHistory, RouteRecordRaw } from 'vue-router'
import NoteView from '@/components/NoteView.vue'

const routes: RouteRecordRaw[] = [
    { path: '/', redirect: '/n' },
    { name: 'columns', path: '/n/:slugs(.*)?', component: NoteView }, // временно
]

const router = createRouter({
    history: createWebHashHistory(),
    routes,
    scrollBehavior() {
        return { left: 0, top: 0 }
    }
})

export default router
