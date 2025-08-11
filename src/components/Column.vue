<script setup lang="ts">
import { defineProps } from 'vue'
import { useColumnsStore } from '@/store/columns'

const props = defineProps<{
    slug: string
    index: number
    canClose?: boolean
}>()

const columns = useColumnsStore()

function close() {
    columns.closeAt(props.index)
}
</script>

<template>
    <section class="column">
        <header class="header">
            <h1 class="note-title">{{ props.slug }}</h1>
            <div class="meta">
                Колонка № {{ props.index + 1 }}
                <button v-if="props.canClose" class="close-btn" @click="close" title="Закрыть">✕</button>
            </div>
        </header>

        <p>Это заглушка. Дальше подключим markdown, вики‑ссылки и бэклинки.</p>
        <hr />
        <p>На следующем шаге страница начнёт читать заметки из <code>notes/</code>.</p>
    </section>
</template>

<style>
/* стили в app.css */
</style>
