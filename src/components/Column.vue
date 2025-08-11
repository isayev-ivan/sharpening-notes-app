<script setup lang="ts">
import { defineProps, nextTick, onMounted, ref, watch } from 'vue'
import { useColumnsStore } from '@/store/columns'
import { loadNoteBySlug, type NoteDoc, findSlugByName } from '@/lib/notes'
import { md } from '@/lib/md'
import { renderPreview } from '@/lib/md' // PREVIEW
import { getBacklinksFor } from '@/lib/graph'
import type { NoteMeta } from '@/lib/notes'
import LinkPreview from './LinkPreview.vue' // PREVIEW
import { usePreviewCache } from '@/lib/previewCache'

const props = defineProps<{
    slug: string
    index: number
    canClose?: boolean
}>()

const columns = useColumnsStore()

const isLoading = ref(true)
const note = ref<NoteDoc | null>(null)
const html = ref<string>('')
const outgoing = ref<string[]>([])
const backlinks = ref<NoteMeta[]>([])

// PREVIEW state
const isTouch = typeof window !== 'undefined'
    && (('ontouchstart' in window) || (navigator.maxTouchPoints ?? 0) > 0)

const previewVisible = ref(false)
const previewHtml = ref('')
const previewX = ref(0)
const previewY = ref(0)
const hoverSlug = ref<string | null>(null)
let showTimer: number | null = null
let hideTimer: number | null = null
let lastMouseX = 0
let lastMouseY = 0

// ✅ модульный кэш, общий для всех колонок
const previewCache = usePreviewCache()

async function fetchNote() {
    isLoading.value = true
    backlinks.value = []
    note.value = await loadNoteBySlug(props.slug)
    if (note.value) {
        const env: any = { resolve: findSlugByName, outgoing: [] as string[] }
        html.value = md.render(note.value.content, env)
        outgoing.value = env.outgoing
        backlinks.value = await getBacklinksFor(note.value.slug)
    } else {
        html.value = ''
        outgoing.value = []
    }
    isLoading.value = false
}

function close() {
    columns.closeAt(props.index)
}

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

watch(() => props.slug, fetchNote, { immediate: true })
onMounted(fetchNote)

/* ================= PREVIEW: делегирование hover ================= */

function positionPreviewWithinViewport(w: number, h: number) {
    const margin = 8
    const offset = 12
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
    // задержка, чтоб не мигал при быстрых перемещениях
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
        // LinkPreview сам сообщит размеры через @resize → скорректируем позицию
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
    if (!a || a.dataset.missing === 'true') {
        hidePreviewSoon()
        return
    }
    const slug = a.dataset.slug!
    if (hoverSlug.value !== slug) {
        showPreviewFor(slug)
    }
}

function onMouseMove(e: MouseEvent) {
    lastMouseX = e.clientX
    lastMouseY = e.clientY
    if (previewVisible.value) {
        // позицию уточним после измерения, но можно подвинуть сразу
        previewX.value = lastMouseX + 12
        previewY.value = lastMouseY + 12
    }
}

function onMouseLeave() {
    hidePreviewSoon()
}

function onPreviewResize(size: { width: number; height: number }) {
    positionPreviewWithinViewport(size.width, size.height)
}
</script>

<template>
    <section
        class="column"
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
        <div v-else v-html="html"></div>

        <!-- ниже основного HTML заметки -->
        <template v-if="backlinks.length">
            <hr />
            <section class="backlinks">
                <div class="meta">Сюда ссылаются:</div>
                <ul class="backlinks-list">
                    <li v-for="m in backlinks" :key="m.slug">
                        <a
                            href="#"
                            class="wikilink"
                            :data-slug="m.slug"
                            data-missing="false"
                        >{{ m.title }}</a>
                    </li>
                </ul>
            </section>
        </template>


        <!-- PREVIEW popover -->
        <LinkPreview
            :visible="previewVisible"
            :x="previewX"
            :y="previewY"
            :html="previewHtml"
            @resize="onPreviewResize"
        />
    </section>
</template>

<style>
/* стили в app.css */
</style>
