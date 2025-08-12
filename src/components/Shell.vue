<script setup lang="ts">
import { onMounted, onUnmounted, watch, nextTick, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useColumnsStore } from '@/store/columns'
import { useUiStore } from '@/store/ui'
import { getManifest } from '@/lib/notes'
import Column from './Column.vue'
import TopBar from './TopBar.vue'
import SearchOverlay from './SearchOverlay.vue'
import ShortcutsOverlay from './ShortcutsOverlay.vue'
import { slugsFromRoute, routeLocationForSlugs } from '@/router'

const columns = useColumnsStore()
const ui = useUiStore()
const route = useRoute()
const router = useRouter()
const shellEl = ref<HTMLElement | null>(null)

let isSyncing = false
const indexSlug = ref<string>('')

function sameArray(a: string[], b: string[]) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
    return true
}
function last<T>(arr: T[]): T | undefined { return arr.length ? arr[arr.length - 1] : undefined }

async function ensureColumnIntoView(idx: number) {
    await nextTick()
    const el = shellEl.value
    if (!el) return
    const cols = el.querySelectorAll<HTMLElement>('.column')
    const col = cols[idx]
    if (!col) return
    const leftAbs = col.offsetLeft
    const rightAbs = leftAbs + col.offsetWidth
    const viewLeft = el.scrollLeft
    const viewRight = viewLeft + el.clientWidth
    let target = viewLeft
    if (leftAbs < viewLeft) target = Math.max(0, leftAbs - 16)
    else if (rightAbs > viewRight) target = rightAbs - el.clientWidth + 16
    el.scrollTo({ left: target, behavior: 'smooth' })
}

async function scrollToLastColumnSmooth() {
    await nextTick()
    const el = shellEl.value
    if (!el) return
    el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' })
}

/* ===== init ===== */
onMounted(async () => {
    const manifest = await getManifest()
    const valid = new Set(manifest.map(m => m.slug))
    const idx = manifest.find(m => m.path.endsWith('/index.md')) ?? manifest[0]
    indexSlug.value = idx ? idx.slug : ''

    let routeSlugs = slugsFromRoute(route).filter(s => valid.has(s))
    if (routeSlugs.length === 0 && indexSlug.value) routeSlugs = [indexSlug.value]

    columns.setColumns(routeSlugs)
    ui.setActiveIndex(Math.max(0, routeSlugs.length - 1))

    isSyncing = true
    const target = routeLocationForSlugs(columns.slugs, indexSlug.value)
    if (!sameArray(slugsFromRoute(route), columns.slugs)) await router.replace(target)
    isSyncing = false

    await scrollToLastColumnSmooth()

    document.addEventListener('keydown', onGlobalKeydown)
})

onUnmounted(() => {
    document.removeEventListener('keydown', onGlobalKeydown)
})

/* ===== Store → URL ===== */
watch(
    () => columns.slugs,
    async (slugs, prev) => {
        if (isSyncing) return
        const grew = slugs.length > ((prev && prev.length) ?? 0)
        if (grew) ui.setActiveIndex(slugs.length - 1)
        else if (ui.activeIndex >= slugs.length) ui.setActiveIndex(Math.max(0, slugs.length - 1))

        isSyncing = true
        const target = routeLocationForSlugs(slugs, indexSlug.value)
        if (!sameArray(slugsFromRoute(route), slugs)) await router.push(target)
        isSyncing = false

        await ensureColumnIntoView(ui.activeIndex)
    },
    { deep: false }
)

/* ===== URL → Store (back/forward) ===== */
watch(
    () => route.fullPath,
    async () => {
        if (isSyncing) return
        const manifest = await getManifest()
        const valid = new Set(manifest.map(m => m.slug))
        const fromUrl = slugsFromRoute(route).filter(s => valid.has(s))
        if (!sameArray(fromUrl, columns.slugs)) {
            columns.setColumns(fromUrl.length ? fromUrl : columns.slugs)
            ui.setActiveIndex(Math.max(0, columns.slugs.length - 1))
            await ensureColumnIntoView(ui.activeIndex)
        }
    }
)

/* ===== Хоткеи ===== */
function isEditableTarget(ev: KeyboardEvent) {
    const t = ev.target as HTMLElement | null
    return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || (t as any).isContentEditable)
}
async function onGlobalKeydown(e: KeyboardEvent) {
    if (e.defaultPrevented) return               // ⬅️ если кто-то уже обработал — выходим

    if (ui.searchOpen || ui.helpOpen || isEditableTarget(e)) return

    if (e.key === '?') { ui.toggleHelp(); e.preventDefault(); return }

    if (e.key === 'ArrowLeft') {
        if (ui.activeIndex > 0) {
            ui.setActiveIndex(ui.activeIndex - 1)
            await ensureColumnIntoView(ui.activeIndex)
        }
        e.preventDefault()
    } else if (e.key === 'ArrowRight') {
        if (ui.activeIndex < columns.slugs.length - 1) {
            ui.setActiveIndex(ui.activeIndex + 1)
            await ensureColumnIntoView(ui.activeIndex)
        }
        e.preventDefault()
    } else if (e.key === 'Escape') {
        // закрываем только если колонок больше одной
        if (columns.slugs.length > 1) {
            const closeIdx = ui.activeIndex
            columns.closeAt(closeIdx)
            const newActive = Math.max(0, Math.min(closeIdx, columns.slugs.length - 1))
            ui.setActiveIndex(newActive)
            await nextTick()
            await ensureColumnIntoView(ui.activeIndex)
            e.preventDefault()
        }
    }
}

/* ===== Активная колонка по скроллу ===== */
let scrollRAF = 0
function onShellScroll() {
    if (scrollRAF) return
    scrollRAF = requestAnimationFrame(updateActiveByVisibility)
}
function updateActiveByVisibility() {
    scrollRAF = 0
    const el = shellEl.value
    if (!el) return
    const cols = Array.from(el.querySelectorAll<HTMLElement>('.column'))
    if (!cols.length) return
    const vw = el.clientWidth
    const sl = el.scrollLeft

    let bestIdx = ui.activeIndex
    let bestScore = -1

    for (let i = 0; i < cols.length; i++) {
        const c = cols[i]
        const left = c.offsetLeft - sl
        const right = left + c.offsetWidth
        const inter = Math.min(right, vw) - Math.max(left, 0)
        const ratio = Math.max(0, inter) / c.offsetWidth
        const center = left + c.offsetWidth / 2
        const centered = center >= 0 && center <= vw
        const score = ratio + (centered ? 1 : 0) // предпочитаем ту, чья середина в вьюпорте
        if (score > bestScore) { bestScore = score; bestIdx = i }
    }

    const THRESH = 0.55 // «видна больше чем наполовину» или центр внутри
    const centeredEnough = bestScore >= 1 /* центр внутри даёт +1 */
    if ((bestScore >= THRESH || centeredEnough) && bestIdx !== ui.activeIndex) {
        ui.setActiveIndex(bestIdx)
    }
}

/* ===== Клик по колонке делает её активной ===== */
async function onShellMouseDown(e: MouseEvent) {
    const el = shellEl.value
    if (!el) return
    const target = e.target as HTMLElement
    const colEl = target.closest('.column') as HTMLElement | null
    if (!colEl) return
    const cols = Array.from(el.querySelectorAll<HTMLElement>('.column'))
    const idx = cols.indexOf(colEl)
    if (idx >= 0 && idx !== ui.activeIndex) {
        ui.setActiveIndex(idx)
        await ensureColumnIntoView(idx)
    }
}
</script>

<template>
    <div class="app-root">
        <TopBar />
        <div
            class="app-shell"
            ref="shellEl"
            @scroll.passive="onShellScroll"
            @mousedown.capture="onShellMouseDown"
        >
            <Column
                v-for="(c, i) in columns.columns"
                :key="c.slug"
                :slug="c.slug"
                :index="i"
                :active="ui.activeIndex === i"
                :can-close="columns.columns.length > 1"
            />
        </div>

        <SearchOverlay />
        <ShortcutsOverlay />
    </div>
</template>

<style>
/* стили — те же (активная колонка уже подсвечивается) */
</style>
