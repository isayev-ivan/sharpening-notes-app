<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useColumnsStore } from '@/store/columns'
import { getManifest } from '@/lib/notes'
import { routeLocationForSlugs } from '@/router'
import ThemeToggle from './ThemeToggle.vue'
import { useUiStore } from '@/store/ui'
const ui = useUiStore()
const router = useRouter()
const columns = useColumnsStore()
const siteTitle = (import.meta.env.VITE_SITE_TITLE as string) ?? 'Название сайта'
const rootSlug = ref<string>('')

onMounted(async () => {
    const manifest = await getManifest()
    const idx = manifest.find(m => m.path.endsWith('/index.md')) ?? manifest[0]
    rootSlug.value = idx ? idx.slug : ''
})
async function goHome() {
    if (!rootSlug.value) return
    columns.setColumns([rootSlug.value])
    await router.push(routeLocationForSlugs([rootSlug.value], rootSlug.value))
}
</script>

<template>
    <header class="topbar">
        <button class="topbar-title" @click="goHome" :disabled="!rootSlug">{{ siteTitle }}</button>

        <nav class="topbar-nav">
            <button class="icon-btn" @click="ui.openSearch()" title="Поиск (/)">
                <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
                    <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" fill="none"/>
                    <path d="M20 20l-4-4" stroke="currentColor" stroke-width="2" fill="none"/>
                </svg>
            </button>
            <button class="icon-btn" @click="ui.toggleHelp()" title="Подсказки (?)">?</button>
            <button class="topbar-link" @click="goHome" :disabled="!rootSlug">Об этих заметках</button>
            <ThemeToggle />
        </nav>
    </header>
</template>

<style>
.topbar{
    position: sticky; top: 0; z-index: 50;
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; padding: 10px 16px;
    border-bottom: 1px solid var(--rule); background: var(--bg);
}
.topbar-nav{ display: flex; align-items: center; gap: 12px; }
.icon-btn{
    display: grid; place-items: center;
    width: 32px; height: 32px; border-radius: 8px;
    border: 1px solid var(--rule); background: transparent; color: var(--fg);
    cursor: pointer; padding: 0;
}
.icon-btn:hover{ background: rgba(0,0,0,.04); }
.icon-btn:focus-visible{ outline: 2px solid var(--link); outline-offset: 2px; }
:root[data-theme="dark"] .icon-btn:hover{ background: rgba(255,255,255,.06); }
</style>
