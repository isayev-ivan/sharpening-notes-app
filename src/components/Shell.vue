<script setup lang="ts">
import { onMounted, watch, nextTick, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useColumnsStore } from '@/store/columns'
import { getManifest } from '@/lib/notes'
import Column from './Column.vue'
import TopBar from './TopBar.vue'
import SearchOverlay from './SearchOverlay.vue'
import { slugsFromRoute, routeLocationForSlugs } from '@/router'

const columns = useColumnsStore()
const route = useRoute()
const router = useRouter()
const shellEl = ref<HTMLElement | null>(null)

let isSyncing = false
const indexSlug = ref<string>('')   // 👈 запомним slug из index.md

function sameArray(a: string[], b: string[]) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
    return true
}
function last<T>(arr: T[]): T | undefined { return arr.length ? arr[arr.length - 1] : undefined }
async function scrollToLastColumnSmooth() {
    await nextTick()
    const el = shellEl.value
    if (!el) return
    el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' })
}

onMounted(async () => {
    const manifest = await getManifest()
    const valid = new Set(manifest.map(m => m.slug))

    // определим «домашний» slug из index.md (или fallback на первую)
    const idx = manifest.find(m => m.path.endsWith('/index.md')) ?? manifest[0]
    indexSlug.value = idx ? idx.slug : ''

    // слуги из URL
    let routeSlugs = slugsFromRoute(route).filter(s => valid.has(s))

    // если URL пуст — открываем index
    if (routeSlugs.length === 0 && indexSlug.value) {
        routeSlugs = [indexSlug.value]
    }

    columns.setColumns(routeSlugs)

    isSyncing = true
    const current = slugsFromRoute(route)
    const target = routeLocationForSlugs(columns.slugs, indexSlug.value)
    if (!sameArray(current, columns.slugs)) {
        await router.replace(target)
    }
    isSyncing = false

    await scrollToLastColumnSmooth()
})

watch(
    () => columns.slugs,
    async (slugs, prev) => {
        if (isSyncing) return
        const current = slugsFromRoute(route)
        const prevLast = prev && prev.length ? prev[prev.length - 1] : undefined
        const lastChanged = (last(slugs) !== prevLast) || (slugs.length > ((prev && prev.length) ?? 0))

        isSyncing = true
        const target = routeLocationForSlugs(slugs, indexSlug.value)
        if (!sameArray(current, slugs)) {
            await router.push(target)
        }
        isSyncing = false

        if (lastChanged) await scrollToLastColumnSmooth()
    },
    { deep: false }
)

watch(
    () => route.fullPath,
    async () => {
        if (isSyncing) return
        const manifest = await getManifest()
        const valid = new Set(manifest.map(m => m.slug))
        const fromUrl = slugsFromRoute(route).filter(s => valid.has(s))
        if (!sameArray(fromUrl, columns.slugs)) {
            columns.setColumns(fromUrl.length ? fromUrl : columns.slugs)
            await scrollToLastColumnSmooth()
        }
    }
)
</script>

<template>
    <div class="app-root">
        <TopBar />
        <div class="app-shell" ref="shellEl">
            <Column
                v-for="(c, i) in columns.columns"
                :key="c.slug"
                :slug="c.slug"
                :index="i"
                :can-close="columns.columns.length > 1"
            />
        </div>

        <SearchOverlay /> <!-- 👈 -->
    </div>
</template>

<style>
/* стили в app.css */
</style>
