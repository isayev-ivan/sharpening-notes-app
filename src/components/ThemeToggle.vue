<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { applyTheme, loadTheme, saveTheme, getSystemTheme, type Theme } from '@/lib/theme'

const theme = ref<Theme>('light')

onMounted(() => {
    theme.value = loadTheme() ?? getSystemTheme()
})

function toggle() {
    theme.value = theme.value === 'light' ? 'dark' : 'light'
    applyTheme(theme.value)
    saveTheme(theme.value)
}
</script>

<template>
    <button
        class="theme-toggle"
        role="switch"
        :aria-checked="theme === 'dark'"
        :title="theme === 'dark' ? 'Тёмная тема' : 'Светлая тема'"
        @click="toggle"
    >
        <span class="track"></span>
        <span class="thumb" :class="{ on: theme === 'dark' }">
      <!-- иконка внутри кружка -->
      <svg v-if="theme === 'light'" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm0-16v3M12 19v3M4 12H1M23 12h-3M4.22 4.22 6.34 6.34M17.66 17.66l2.12 2.12M17.66 6.34l2.12-2.12M4.22 19.78l2.12-2.12"
              fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <svg v-else width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"
              fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </span>
    </button>
</template>

<style>
.theme-toggle{
    position: relative;
    width: 52px; height: 28px;
    border-radius: 999px;
    border: 2px solid #2c56e3;             /* как у VitePress — синий ободок */
    background: transparent;
    padding: 0; cursor: pointer;
}
.theme-toggle:focus-visible{
    outline: 2px solid var(--link);
    outline-offset: 2px;
    border-radius: 999px;
}
.theme-toggle .track{
    position: absolute; inset: 2px;
    background: #eef0f5;
    border-radius: 999px;
}
.theme-toggle .thumb{
    position: absolute; top: 3px; left: 3px;
    width: 22px; height: 22px;
    border-radius: 50%;
    background: #fff;
    color: #777;
    display: grid; place-items: center;
    box-shadow: 0 1px 2px rgba(0,0,0,.15);
    transition: transform .18s ease, background .18s ease;
}
.theme-toggle .thumb.on{
    transform: translateX(24px);
}
[data-theme="dark"] .theme-toggle .track{
    background: #1e2230;
}
[data-theme="dark"] .theme-toggle .thumb{
    background: #0f1117; color: #c6c6c6;
    box-shadow: 0 1px 2px rgba(0,0,0,.3);
}
</style>
