<script setup lang="ts">
import { defineProps, onMounted, ref, watch } from 'vue'
import { useColumnsStore } from '@/store/columns'
import { loadNoteBySlug, type NoteDoc } from '@/lib/notes'
import { md } from '@/lib/md'

const props = defineProps<{
    slug: string
    index: number
    canClose?: boolean
}>()

const columns = useColumnsStore()

const isLoading = ref(true)
const note = ref<NoteDoc | null>(null)
const html = ref<string>('')

async function fetchNote() {
    isLoading.value = true
    note.value = await loadNoteBySlug(props.slug)
    if (note.value) {
        html.value = md.render(note.value.content)
    } else {
        html.value = ''
    }
    isLoading.value = false
}

function close() {
    columns.closeAt(props.index)
}

watch(() => props.slug, fetchNote, { immediate: true })
onMounted(fetchNote)
</script>

<template>
    <section class="column">
        <header class="header">
            <h1 class="note-title">
                {{ note?.title ?? props.slug }}
            </h1>
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
    </section>
</template>

<style>
/* стили в app.css */
</style>
