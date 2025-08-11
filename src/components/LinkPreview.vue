<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'

const props = defineProps<{
    visible: boolean
    x: number
    y: number
    html: string
}>()

const emit = defineEmits<{
    (e: 'resize', size: { width: number; height: number }): void
}>()

const root = ref<HTMLElement | null>(null)

async function measureAndEmit() {
    await nextTick()
    if (!props.visible || !root.value) return
    const r = root.value.getBoundingClientRect()
    emit('resize', { width: r.width, height: r.height })
}

watch(() => [props.visible, props.html], measureAndEmit)

onMounted(measureAndEmit)
</script>

<template>
    <div
        v-show="visible"
        ref="root"
        class="link-preview"
        :style="{ left: x + 'px', top: y + 'px' }"
    >
        <div class="link-preview__inner" v-html="html"></div>
    </div>
</template>

<style>
/* Базовый поповер — без наворотов, минимализм */
.link-preview {
    position: fixed;
    z-index: 1000;
    max-width: 380px;
    max-height: 60vh;
    overflow: auto;
    border: 1px solid var(--rule);
    background: var(--bg);
    box-shadow: 0 8px 24px rgba(0,0,0,0.12);
    padding: 10px 12px;
    pointer-events: none; /* не перехватываем мышь */
}
.link-preview__inner {
    font-size: 14px;
    line-height: 1.5;
}
.link-preview__inner p { margin: 0 0 8px; }
</style>
