<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useColumnsStore } from '@/store/columns'
import { getManifest } from '@/lib/notes'
import Column from './Column.vue'
import { slugsFromRoute, routeLocationForSlugs } from '@/router'

const columns = useColumnsStore()
const route = useRoute()
const router = useRouter()

let isSyncing = false

function sameArray(a: string[], b: string[]) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
    return true
}

onMounted(async () => {
    // 1) Валидируем слуги из URL по манифесту
    const manifest = await getManifest()
    const valid = new Set(manifest.map(m => m.slug))

    let routeSlugs = slugsFromRoute(route).filter(s => valid.has(s))

    if (routeSlugs.length === 0) {
        // используем home.md или первую
        const home = manifest.find(m => m.path.endsWith('/home.md'))
        const initial = home ?? manifest[0]
        routeSlugs = initial ? [initial.slug] : []
    }

    // 2) Инициализируем store из URL/вычисленного набора
    columns.setColumns(routeSlugs)

    // 3) Приводим URL к каноническому виду (на случай фильтрации/добавления)
    isSyncing = true
    await router.replace(routeLocationForSlugs(columns.slugs))
    isSyncing = false
})

// 4) Следим за изменениями store → обновляем URL
watch(() => columns.slugs, async (slugs, prev) => {
    if (isSyncing) return
    const current = slugsFromRoute(route)
    if (sameArray(current, slugs)) return
    isSyncing = true
    await router.push(routeLocationForSlugs(slugs))
    isSyncing = false
}, { deep: false })

// 5) Следим за изменениями URL (back/forward) → обновляем store
watch(() => route.fullPath, async () => {
    if (isSyncing) return
    const manifest = await getManifest()
    const valid = new Set(manifest.map(m => m.slug))
    const fromUrl = slugsFromRoute(route).filter(s => valid.has(s))
    if (!sameArray(fromUrl, columns.slugs)) {
        isSyncing = true
        columns.setColumns(fromUrl.length ? fromUrl : columns.slugs)
        isSyncing = false
    }
})
</script>

<template>
    <div class="app-shell">
        <Column
            v-for="(c, i) in columns.columns"
            :key="c.slug"
            :slug="c.slug"
            :index="i"
            :can-close="columns.columns.length > 1"
        />
    </div>
</template>

<style>
/* стили в app.css */
</style>
