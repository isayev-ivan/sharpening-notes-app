<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useColumnsStore } from '@/store/columns'
import { getManifest } from '@/lib/notes'
import { routeLocationForSlugs } from '@/router'
import ThemeToggle from './ThemeToggle.vue'

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
    await router.push(routeLocationForSlugs([rootSlug.value], rootSlug.value)) // 👈 на корень
}
</script>

<template>
    <header class="topbar">
        <button class="topbar-title" @click="goHome" :disabled="!rootSlug">{{ siteTitle }}</button>
        <nav class="topbar-nav">
            <button class="topbar-link" @click="goHome" :disabled="!rootSlug">Об этих заметках</button>
            <ThemeToggle />
        </nav>
    </header>
</template>


<!-- стили оставляем как были -->

<style>
.topbar{
    position: sticky; top: 0; z-index: 50;
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 16px;
    border-bottom: 1px solid var(--rule);
    background: var(--bg);
}
.topbar-title{
    font: inherit; font-weight: 600; letter-spacing: .2px;
    background: transparent; border: none; cursor: pointer; padding: 0;
    color: var(--fg);
}
.topbar-title:disabled{ opacity:.5; cursor: default; }
.topbar-title:focus-visible{ outline: 2px solid var(--link); outline-offset: 2px; border-radius: 4px; }
.topbar-nav{ display: flex; align-items: center; gap: 14px; }
.topbar-link{
    font: inherit; background: transparent; border: none; cursor: pointer; padding: 0;
    color: var(--link);
}
.topbar-link:disabled{ opacity:.5; cursor: default; }
.topbar-link:hover{ text-decoration: underline; }
.topbar-link:focus-visible{ outline: 2px solid var(--link); outline-offset: 2px; border-radius: 4px; }
</style>
