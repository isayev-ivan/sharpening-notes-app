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
import { saveJSON, loadJSON } from '@/lib/storage'
import { updateSEO } from '@/lib/seo'

const columns = useColumnsStore()
const ui = useUiStore()
const route = useRoute()
const router = useRouter()
const shellEl = ref<any>(null)

/** Возвращает настоящий DOM-элемент контейнера колонок */
function getShellEl(): HTMLElement | null {
    const raw = shellEl.value
    if (!raw) return null
    // Если это уже HTMLElement — вернём его; если компонент — вернём $el
    return raw instanceof HTMLElement ? raw : (raw.$el as HTMLElement | null)
}

let isSyncing = false
let restoringFromStorage = false            // ⬅️ флаг «восстанавливаем нач. состояние»
const indexSlug = ref<string>('')

const STORAGE_ACTIVE = 'activeSlug:v1'
const STORAGE_HSCROLL = 'hscroll:v1'

function sameArray(a: string[], b: string[]) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
    return true
}
function last<T>(arr: T[]): T | undefined { return arr.length ? arr[arr.length - 1] : undefined }

async function ensureColumnIntoView(idx: number) {
    await nextTick()
    const el = getShellEl()
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
    const el = getShellEl()
    if (!el) return
    el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' })
}

/* ===== helpers: persist ===== */
function saveActiveSlugByIndex(idx: number) {
    const slug = columns.slugs[idx]
    if (slug) saveJSON(STORAGE_ACTIVE, slug)
}
function saveHScrollLeft() {
    const el = getShellEl()
    if (el) saveJSON(STORAGE_HSCROLL, Math.round(el.scrollLeft))
}

/* ===== init ===== */
onMounted(async () => {
    const manifest = await getManifest()
    const valid = new Set(manifest.map(m => m.slug))
    const idx = manifest.find(m => m.path.endsWith('/index.md')) ?? manifest[0]
    indexSlug.value = idx ? idx.slug : ''

    // слуги из URL
    let routeSlugs = slugsFromRoute(route).filter(s => valid.has(s))
    if (routeSlugs.length === 0 && indexSlug.value) routeSlugs = [indexSlug.value]

    columns.setColumns(routeSlugs)

    // восстановим активную колонку и горизонтальный скролл
    const savedActive = loadJSON<string | null>(STORAGE_ACTIVE, null)
    const savedH = loadJSON<number | null>(STORAGE_HSCROLL, null)

    const savedIdx = savedActive ? routeSlugs.indexOf(savedActive) : -1
    if (savedIdx >= 0) ui.setActiveIndex(savedIdx)
    else ui.setActiveIndex(Math.max(0, routeSlugs.length - 1))

    if (typeof savedH === 'number') restoringFromStorage = true

    // синхронизация URL
    isSyncing = true
    const target = routeLocationForSlugs(columns.slugs, indexSlug.value)
    if (!sameArray(slugsFromRoute(route), columns.slugs)) await router.replace(target)
    isSyncing = false

    // применим сохранённый горизонтальный скролл (если был)
    if (typeof savedH === 'number') {
        await nextTick()
        const el = getShellEl()
        if (el) el.scrollLeft = savedH
        restoringFromStorage = false
    } else {
        await scrollToLastColumnSmooth()
    }

    // ⬇️ первичная установка SEO для активной заметки
    updateSEO(columns.slugs[ui.activeIndex] ?? null, indexSlug.value)

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
        if (grew && !restoringFromStorage) ui.setActiveIndex(slugs.length - 1)
        else if (ui.activeIndex >= slugs.length) ui.setActiveIndex(Math.max(0, slugs.length - 1))

        isSyncing = true
        const target = routeLocationForSlugs(slugs, indexSlug.value)
        if (!sameArray(slugsFromRoute(route), slugs)) await router.push(target)
        isSyncing = false

        if (!restoringFromStorage) await ensureColumnIntoView(ui.activeIndex)
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
            // активную пытаемся восстановить по сохранённому slug
            const savedActive = loadJSON<string | null>(STORAGE_ACTIVE, null)
            const idx = savedActive ? columns.slugs.indexOf(savedActive) : -1
            ui.setActiveIndex(idx >= 0 ? idx : Math.max(0, columns.slugs.length - 1))
            await ensureColumnIntoView(ui.activeIndex)
        }
    }
)

/* ===== SEO: обновляем при смене активной или состава колонок ===== */
watch(
    () => [ui.activeIndex, columns.slugs] as const,
    () => {
        const activeSlug = columns.slugs[ui.activeIndex] ?? null
        updateSEO(activeSlug, indexSlug.value)
    },
    { deep: false }
)

/* ===== Хоткеи ===== */
function isEditableTarget(ev: KeyboardEvent) {
    const t = ev.target as HTMLElement | null
    return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || (t as any).isContentEditable)
}
async function onGlobalKeydown(e: KeyboardEvent) {
    if (e.defaultPrevented) return
    if (ui.searchOpen || ui.helpOpen || isEditableTarget(e)) return

    if (e.key === '?') { ui.toggleHelp(); e.preventDefault(); return }

    if (e.key === 'ArrowLeft') {
        if (ui.activeIndex > 0) {
            ui.setActiveIndex(ui.activeIndex - 1)
            saveActiveSlugByIndex(ui.activeIndex)          // ⬅️ сохраняем выбор
            await ensureColumnIntoView(ui.activeIndex)
        }
        e.preventDefault()
    } else if (e.key === 'ArrowRight') {
        if (ui.activeIndex < columns.slugs.length - 1) {
            ui.setActiveIndex(ui.activeIndex + 1)
            saveActiveSlugByIndex(ui.activeIndex)
            await ensureColumnIntoView(ui.activeIndex)
        }
        e.preventDefault()
    } else if (e.key === 'Escape') {
        // не закрываем, если колонка единственная
        if (columns.slugs.length > 1) {
            const closeIdx = ui.activeIndex
            columns.closeAt(closeIdx)
            const newActive = Math.max(0, Math.min(closeIdx, columns.slugs.length - 1))
            ui.setActiveIndex(newActive)
            saveActiveSlugByIndex(newActive)
            await nextTick()
            await ensureColumnIntoView(ui.activeIndex)
            e.preventDefault()
        }
    }
}

/* ===== Активная колонка по горизонтальному скроллу + сохранение скролла ===== */
let scrollRAF = 0
function onShellScroll() {
    if (scrollRAF) return
    scrollRAF = requestAnimationFrame(updateActiveByVisibility)
}
function updateActiveByVisibility() {
    scrollRAF = 0
    const el = getShellEl()
    if (!el) return
    const cols = Array.from(el.querySelectorAll<HTMLElement>('.column'))
    if (!cols.length) return

    const vw = el.clientWidth
    const sl = el.scrollLeft
    const maxSL = Math.max(0, el.scrollWidth - el.clientWidth)
    const EPS = 2 // допуск на субпиксели/инерцию

    // ⬅️ Новый: если на левом/правом краю — жёстко фиксируем активную
    if (maxSL > 0) {
        if (sl <= EPS) {
            if (ui.activeIndex !== 0) {
                ui.setActiveIndex(0)
                saveActiveSlugByIndex(0)
            }
            saveHScrollLeft()
            return
        }
        if (sl >= maxSL - EPS) {
            const lastIdx = cols.length - 1
            if (ui.activeIndex !== lastIdx) {
                ui.setActiveIndex(lastIdx)
                saveActiveSlugByIndex(lastIdx)
            }
            saveHScrollLeft()
            return
        }
    }

    // Обычная эвристика «кто лучше виден/центрирован»
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
        const score = ratio + (centered ? 1 : 0)
        if (score > bestScore) { bestScore = score; bestIdx = i }
    }

    const THRESH = 0.55
    const centeredEnough = bestScore >= 1
    if ((bestScore >= THRESH || centeredEnough) && bestIdx !== ui.activeIndex) {
        ui.setActiveIndex(bestIdx)
        saveActiveSlugByIndex(bestIdx)
    }

    saveHScrollLeft()
}


/* ===== Клик по колонке делает её активной и скроллит к ней ===== */
async function onShellMouseDown(e: MouseEvent) {
    const el = getShellEl()
    if (!el) return
    const target = e.target as HTMLElement
    const colEl = target.closest('.column') as HTMLElement | null
    if (!colEl) return
    const cols = Array.from(el.querySelectorAll<HTMLElement>('.column'))
    const idx = cols.indexOf(colEl)
    if (idx >= 0 && idx !== ui.activeIndex) {
        ui.setActiveIndex(idx)
        saveActiveSlugByIndex(idx)
        await ensureColumnIntoView(idx)
    }
}
</script>

<template>
    <div class="app-root">
        <TopBar />
        <TransitionGroup
            name="col"
            tag="div"
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
        </TransitionGroup>

        <SearchOverlay />
        <ShortcutsOverlay />
    </div>
</template>

<style>
/* стили — без изменений; активная колонка уже подсвечивается */
</style>
