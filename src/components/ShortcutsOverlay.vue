<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useUiStore } from '@/store/ui'
const ui = useUiStore()

function onKey(e: KeyboardEvent) {
    if (!ui.helpOpen) return
    if (e.key === 'Escape') {
        e.preventDefault()
        e.stopImmediatePropagation()               // ⬅️ не пускаем событие дальше
        ui.closeHelp()
    }
}
onMounted(() => document.addEventListener('keydown', onKey))
onUnmounted(() => document.removeEventListener('keydown', onKey))
</script>

<template>
    <transition name="overlay-fade">
        <div v-show="ui.helpOpen" class="overlay" role="dialog" aria-modal="true" aria-label="Подсказки по клавишам">
            <div class="backdrop" @click="ui.closeHelp()" />
            <div class="panel">
                <h3>Горячие клавиши</h3>
                <ul>
                    <li><kbd>/</kbd> — открыть поиск</li>
                    <li><kbd>←</kbd> / <kbd>→</kbd> — переключить активную колонку</li>
                    <li><kbd>Esc</kbd> — закрыть правую колонку (если колонок больше одной)</li>
                    <li><kbd>?</kbd> — показать/скрыть это окно</li>
                </ul>
            </div>
        </div>
    </transition>
</template>

<style>
.overlay{ position: fixed; inset: 0; z-index: 1900; display: flex; justify-content: center; align-items: flex-start; pointer-events: none; }
.backdrop{ position: absolute; inset: 0; background: rgba(0,0,0,.35); pointer-events: auto; }
.panel{
    pointer-events: auto; position: relative; z-index: 1;
    width: min(520px, calc(100% - 24px)); margin: 12vh 12px 0; padding: 16px;
    background: var(--bg); color: var(--fg); border: 1px solid var(--rule);
    border-radius: 12px; box-shadow: 0 24px 48px rgba(0,0,0,.25);
}
h3{ margin: 0 0 8px; font-size: 16px; }
ul{ margin: 0; padding-left: 18px; }
li{ margin: 6px 0; }
kbd{
    font: 12px/1.2 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    border: 1px solid var(--rule); border-bottom-width: 2px; border-radius: 6px;
    padding: 2px 6px; background: #eef0f5; color: #333;
}
:root[data-theme="dark"] kbd{ background: #1e2230; color: #e6e8ee; border-color: #2a2f3e; }
.overlay-fade-enter-active,.overlay-fade-leave-active{ transition: opacity .18s ease; }
.overlay-fade-enter-from,.overlay-fade-leave-to{ opacity: 0; }
</style>
