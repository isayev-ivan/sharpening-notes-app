<script setup lang="ts">
import { defineProps, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useColumnsStore } from '@/store/columns'
import { loadNoteBySlug, type NoteDoc, findSlugByName } from '@/lib/notes'
import { md, renderPreview } from '@/lib/md'
import { getBacklinksFor } from '@/lib/graph'
import type { NoteMeta } from '@/lib/notes'
import LinkPreview from './LinkPreview.vue'
import { runIdleQueue } from '@/lib/idle'


const props = defineProps<{ slug: string; index: number; canClose?: boolean; active?: boolean }>()

const columns = useColumnsStore()

const isLoading = ref(true)
const note = ref<NoteDoc | null>(null)
const html = ref<string>('')
const outgoing = ref<string[]>([])
const backlinks = ref<NoteMeta[]>([])

const isTouch = typeof window !== 'undefined'
    && (('ontouchstart' in window) || (navigator.maxTouchPoints ?? 0) > 0)

// === PREVIEW state ===
const previewVisible = ref(false)
const previewHtml = ref('')
const previewX = ref(0)
const previewY = ref(0)
const hoverSlug = ref<string | null>(null)
let showTimer: number | null = null
let hideTimer: number | null = null
let lastMouseX = 0
let lastMouseY = 0

// общий модульный кэш превью
const previewCache = new Map<string, string>()

// контейнер колонки (он скроллится)
const container = ref<HTMLElement | null>(null)

async function fetchNote() {
    isLoading.value = true
    backlinks.value = []
    note.value = await loadNoteBySlug(props.slug)
    if (note.value) {
        const env: any = { resolve: findSlugByName, outgoing: [] as string[] }
        html.value = md.render(note.value.content, env)
        outgoing.value = env.outgoing
        backlinks.value = await getBacklinksFor(note.value.slug)
        await nextTick()
        restoreScroll()
        prefetchLinkedPreviews()
    } else {
        html.value = ''
        outgoing.value = []
    }
    isLoading.value = false
}

function close() { columns.closeAt(props.index); }

function onContentClick(e: MouseEvent) {
    const a = (e.target as HTMLElement).closest('a.wikilink') as HTMLAnchorElement | null
    if (!a) return
    e.preventDefault()
    const missing = a.dataset.missing === 'true'
    const slug = a.dataset.slug
    if (!missing && slug) {
        hidePreviewNow()
        columns.openToRightOf(props.index, slug)
    }
}

// -------- Preview handlers --------
function positionPreviewWithinViewport(w: number, h: number) {
    const margin = 8, offset = 12
    let x = lastMouseX + offset
    let y = lastMouseY + offset
    if (x + w > window.innerWidth - margin) x = lastMouseX - w - offset
    if (y + h > window.innerHeight - margin) y = Math.max(margin, window.innerHeight - h - margin)
    previewX.value = Math.max(margin, x)
    previewY.value = Math.max(margin, y)
}

async function showPreviewFor(slug: string) {
    if (isTouch) return
    hoverSlug.value = slug
    if (showTimer) window.clearTimeout(showTimer)
    if (hideTimer) window.clearTimeout(hideTimer)
    showTimer = window.setTimeout(async () => {
        let html = previewCache.get(slug)
        if (!html) {
            const n = await loadNoteBySlug(slug)
            html = n ? renderPreview(n.content, 3) : ''
            previewCache.set(slug, html)
        }
        previewHtml.value = html ?? ''
        previewVisible.value = !!html
        await nextTick()
    }, 180)
}

function hidePreviewSoon() {
    if (showTimer) { window.clearTimeout(showTimer); showTimer = null }
    if (hideTimer) window.clearTimeout(hideTimer)
    hideTimer = window.setTimeout(() => {
        previewVisible.value = false
        hoverSlug.value = null
    }, 80)
}
function hidePreviewNow() {
    if (showTimer) { window.clearTimeout(showTimer); showTimer = null }
    if (hideTimer) { window.clearTimeout(hideTimer); hideTimer = null }
    previewVisible.value = false
    hoverSlug.value = null
}

function onMouseOver(e: MouseEvent) {
    const a = (e.target as HTMLElement).closest('a.wikilink') as HTMLAnchorElement | null
    if (!a || a.dataset.missing === 'true') { hidePreviewSoon(); return }
    const slug = a.dataset.slug!
    if (hoverSlug.value !== slug) showPreviewFor(slug)
}
function onMouseMove(e: MouseEvent) {
    lastMouseX = e.clientX; lastMouseY = e.clientY
    if (previewVisible.value) { previewX.value = lastMouseX + 12; previewY.value = lastMouseY + 12 }
}
function onMouseLeave() { hidePreviewSoon() }
function onPreviewResize(size: { width: number; height: number }) { positionPreviewWithinViewport(size.width, size.height) }

// -------- Scroll persist --------
// запись скролла (как было)
function onScroll() {
    if (!container.value) return
    columns.setScrollForSlug(props.slug, container.value.scrollTop)
    hidePreviewSoon()
}

// восстановление – несколько попыток
function restoreScroll() {
    if (!container.value) return
    const target = columns.getScrollForSlug(props.slug) ?? 0
    let tries = 0
    const apply = () => {
        if (!container.value) return
        container.value.scrollTop = target
        // если не "прилипло" (контента ещё мало) — повторим до 6 кадров
        if (tries < 6 && Math.abs(container.value.scrollTop - target) > 2) {
            tries++
            requestAnimationFrame(apply)
        }
    }
    // подождём рендер
    requestAnimationFrame(apply)
}



// -------- Esc to close preview --------
function onKeydown(e: KeyboardEvent) { if (e.key === 'Escape') hidePreviewNow() }

// -------- Idle prefetch of linked previews --------
function requestIdle(cb: () => void) {
    const ric = window.requestIdleCallback || ((fn: any) => setTimeout(fn, 0))
    ric(() => cb())
}
function prefetchLinkedPreviews() {
    if (isTouch || !container.value) return
    const links = Array.from(container.value!.querySelectorAll<HTMLAnchorElement>('a.wikilink[data-missing="false"]'))
    const slugs = [...new Set(links.map(a => a.dataset.slug!).filter(Boolean))].slice(0, 8)
    const queue = slugs.filter(s => !previewCache.has(s)).slice()

    runIdleQueue(() => {
        const slug = queue.shift()
        if (!slug) return false
        loadNoteBySlug(slug).then(n => {
            if (n) previewCache.set(slug, renderPreview(n.content, 3))
        })
        return queue.length > 0
    })
}


watch(() => props.slug, fetchNote, { immediate: true })

onMounted(() => {
    document.addEventListener('keydown', onKeydown)
    container.value?.addEventListener('scroll', onScroll, { passive: true })
    restoreScroll()
})
onUnmounted(() => {
    document.removeEventListener('keydown', onKeydown)
    container.value?.removeEventListener('scroll', onScroll)
})
</script>

<template>
    <section
        class="column"
        :class="{ active: props.active }"
        ref="container"
        @click="onContentClick"
        @mouseover="onMouseOver"
        @mousemove="onMouseMove"
        @mouseleave="onMouseLeave"
    >
        <header class="header">
            <h1 class="note-title">{{ note?.title ?? props.slug }}</h1>
            <div class="meta">
                Колонка № {{ props.index + 1 }}
                <button v-if="props.canClose" class="close-btn" @click="close" title="Закрыть">✕</button>
            </div>
        </header>

        <div v-if="isLoading">Загрузка…</div>
        <div v-else-if="!note">
            <p>Заметка с slug <code>{{ props.slug }}</code> не найдена.</p>
            <p>Проверьте, существует ли файл в <code>/notes</code> и корректный <code>frontmatter.title</code>.</p>
        </div>
        <div v-else>
            <div v-html="html"></div>

            <template v-if="backlinks.length">
                <hr />
                <section class="backlinks">
                    <div class="meta">Сюда ссылаются:</div>
                    <ul class="backlinks-list">
                        <li v-for="m in backlinks" :key="m.slug">
                            <a href="#" class="wikilink" :data-slug="m.slug" data-missing="false">{{ m.title }}</a>
                        </li>
                    </ul>
                </section>
            </template>
        </div>

        <LinkPreview :visible="previewVisible" :x="previewX" :y="previewY" :html="previewHtml" @resize="onPreviewResize" />
    </section>
</template>

<style>
/* стили в app.css */
</style>
