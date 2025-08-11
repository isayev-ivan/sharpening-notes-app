<script setup lang="ts">
import { defineProps, onMounted, ref, watch } from 'vue'
import { useColumnsStore } from '@/store/columns'
import { loadNoteBySlug, type NoteDoc, findSlugByName } from '@/lib/notes'
import { md } from '@/lib/md'
import { getBacklinksFor } from '@/lib/graph'
import type { NoteMeta } from '@/lib/notes'

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

async function fetchNote() {
    isLoading.value = true
    backlinks.value = []
    note.value = await loadNoteBySlug(props.slug)
    if (note.value) {
        const env: any = { resolve: findSlugByName, outgoing: [] as string[] }
        html.value = md.render(note.value.content, env)
        outgoing.value = env.outgoing
        // Бэклинки
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

// делегирование клика по вики-ссылкам
function onContentClick(e: MouseEvent) {
    const a = (e.target as HTMLElement).closest('a.wikilink') as HTMLAnchorElement | null
    if (!a) return
    e.preventDefault()
    const missing = a.dataset.missing === 'true'
    const slug = a.dataset.slug
    if (!missing && slug) {
        columns.openToRightOf(props.index, slug)
    }
}

watch(() => props.slug, fetchNote, { immediate: true })
onMounted(fetchNote)
</script>

<template>
    <section class="column" @click="onContentClick">
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

            <!-- NEW: блок бэклинков -->
            <template v-if="backlinks.length">
                <hr />
                <section class="backlinks">
                    <div class="meta">Сюда ссылаются:</div>
                    <ul class="backlinks-list">
                        <li v-for="m in backlinks" :key="m.slug">
                            <a href="#"
                               class="wikilink"
                               :data-slug="m.slug"
                               data-missing="false">{{ m.title }}</a>
                        </li>
                    </ul>
                </section>
            </template>
        </div>
    </section>
</template>

<style>
/* стили в app.css */
</style>
