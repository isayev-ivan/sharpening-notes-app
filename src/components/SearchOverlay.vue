<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import manifest from 'virtual:notes-manifest'
import graph from 'virtual:notes-graph'
import { useUiStore } from '@/store/ui'
import { useColumnsStore } from '@/store/columns'
import { toSlug } from '@/lib/slug'

type Row = { title: string; slug: string; aliases: string[] }

const rows: Row[] = manifest.map(m => ({
    title: m.title,
    slug: m.slug,
    aliases: graph.aliasesBySlug?.[m.slug] ?? []
}))

const ui = useUiStore()
const columns = useColumnsStore()

const q = ref('')
const hi = ref(0)
const inputEl = ref<HTMLInputElement | null>(null)

const qLower = computed(() => q.value.trim().toLowerCase())
const qSlug  = computed(() => toSlug(q.value.trim()))

type Scored = {
    item: Row
    score: number
    hit: 'title' | 'slug' | 'alias' | null
    matchText: string | null
}

// простая подсветка: оборачиваем совпадение <mark>
function highlight(text: string, needle: string) {
    if (!needle) return escapeHtml(text)
    const i = text.toLowerCase().indexOf(needle.toLowerCase())
    if (i === -1) return escapeHtml(text)
    const a = escapeHtml(text.slice(0, i))
    const b = escapeHtml(text.slice(i, i + needle.length))
    const c = escapeHtml(text.slice(i + needle.length))
    return `${a}<mark>${b}</mark>${c}`
}
function escapeHtml(s: string) {
    return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]!))
}

const results = computed(() => {
    const ql = qLower.value
    const qs = qSlug.value
    if (!ql) return [] as Scored[]

    const scored: Scored[] = rows.map(item => {
        const title = item.title.toLowerCase()
        let score = 0; let hit: Scored['hit'] = null; let matchText: string | null = null

        if (item.slug.startsWith(qs)) { score += 4; hit = 'slug'; matchText = qs }
        else if (item.slug.includes(qs) && qs) { score += 2; hit = 'slug'; matchText = qs }

        if (title.startsWith(ql)) { score += 3; hit = 'title'; matchText = ql }
        else if (title.includes(ql)) { score += 2; hit = 'title'; matchText = ql }

        // алиасы: берём лучший
        for (const a of item.aliases) {
            const al = a.toLowerCase()
            if (al.startsWith(ql)) { score += 2; hit = 'alias'; matchText = ql; break }
            if (al.includes(ql))   { score += 1; hit = 'alias'; matchText = ql; }
        }

        return { item, score, hit, matchText }
    }).filter(s => s.score > 0)

    scored.sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title, 'ru'))
    return scored.slice(0, 12)
})

function select(sc: Scored) {
    ui.closeSearch()
    q.value = ''
    columns.openRight(sc.item.slug)
}

function onKeydown(e: KeyboardEvent) {
    if (!ui.searchOpen) return
    if (e.key === 'Escape') { ui.closeSearch(); e.preventDefault(); return }
    if (!results.value.length) return
    if (e.key === 'ArrowDown') { hi.value = (hi.value + 1) % results.value.length; e.preventDefault() }
    else if (e.key === 'ArrowUp') { hi.value = (hi.value - 1 + results.value.length) % results.value.length; e.preventDefault() }
    else if (e.key === 'Enter') { const r = results.value[hi.value]; if (r) { select(r); e.preventDefault() } }
}

function globalSlash(e: KeyboardEvent) {
    if (e.key !== '/') return
    const t = e.target as HTMLElement | null
    const isEditable = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || (t as any).isContentEditable)
    if (isEditable) return
    e.preventDefault()
    ui.openSearch()
}

watch(() => ui.searchOpen, async (open) => {
    document.documentElement.classList.toggle('modal-open', open)
    if (open) {
        await nextTick()
        inputEl.value?.focus()
    } else {
        q.value = ''
        hi.value = 0
    }
})

onMounted(() => {
    document.addEventListener('keydown', onKeydown)
    document.addEventListener('keydown', globalSlash)
})
onUnmounted(() => {
    document.removeEventListener('keydown', onKeydown)
    document.removeEventListener('keydown', globalSlash)
})
</script>

<template>
    <transition name="overlay-fade">
        <div v-show="ui.searchOpen" class="search-overlay" role="dialog" aria-modal="true" aria-label="Поиск">
            <!-- BACKDROP ниже по z-index -->
            <div class="backdrop" @click="ui.closeSearch()" />
            <!-- PANEL выше по z-index -->
            <div class="search-panel">
                <div class="search-row">
                    <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" fill="none"/><path d="M20 20l-4-4" stroke="currentColor" stroke-width="2" fill="none"/></svg>
                    <input
                        ref="inputEl"
                        class="search-input"
                        type="search"
                        v-model="q"
                        placeholder="Поиск заметок… (Esc — закрыть)"
                        autocomplete="off" spellcheck="false"
                    />
                </div>

                <transition name="panel-slide">
                    <ul v-show="results.length" class="result-list">
                        <li
                            v-for="(r, i) in results"
                            :key="r.item.slug"
                            class="result-item" :class="{ active: i === hi }"
                            @mousedown.prevent="select(r)"
                        >
                            <div class="primary" v-html="highlight(r.item.title, r.hit === 'title' ? (r.matchText||'') : '')"></div>
                            <div class="secondary">
                <span v-if="r.hit==='alias'">
                  aka <span v-html="highlight(r.item.aliases.find(a => a.toLowerCase().includes((r.matchText||''))) || '', r.matchText||'')"></span>
                </span>
                                <span v-else v-html="highlight('/' + r.item.slug, r.hit==='slug' ? (r.matchText||'') : '')"></span>
                            </div>
                        </li>
                    </ul>
                </transition>
            </div>
        </div>
    </transition>
</template>

<style>
/* overlay container — flex: панель не растягивается на всю высоту */
.search-overlay{
    position: fixed; inset: 0; z-index: 2000;
    display: flex; align-items: flex-start; justify-content: center;
    pointer-events: none; /* клики только по дочерним с auto */
}

/* слои */
.backdrop{
    position: absolute; inset: 0;
    background: rgba(0,0,0,.35);
    z-index: 1;
    pointer-events: auto;
}
.search-panel{
    position: relative;
    z-index: 2;
    pointer-events: auto;

    width: min(760px, calc(100% - 24px));
    margin: 8vh 12px 0;
    background: var(--bg);
    border: 1px solid var(--rule);
    border-radius: 12px;
    box-shadow: 0 24px 48px rgba(0,0,0,.25);
    overflow: hidden; /* скролл только у списка результатов */
}

/* верхняя строка */
.search-row{
    display: grid; grid-template-columns: 36px 1fr; align-items: center;
    padding: 12px 14px; gap: 6px; border-bottom: 1px solid var(--rule);
}
.search-row .icon{ width: 20px; height: 20px; color: var(--muted); justify-self: center; }
.search-input{
    width: 100%; font: inherit; font-size: 16px;
    background: transparent; color: var(--fg);
    border: none; outline: none;
}

/* результаты — ограничиваем высоту, панель подстраивается под контент */
.result-list{
    max-height: min(60vh, 520px);
    overflow: auto;
    margin: 0; padding: 6px 0; list-style: none;
}
.result-item{ padding: 10px 14px; cursor: pointer; }
.result-item .primary{ font-weight: 600; }
.result-item .secondary{ color: var(--muted); font-size: 12px; margin-top: 2px; }

mark{ background: rgba(255, 230, 110, .7); color: inherit; padding: 0 1px; border-radius: 2px; }
.result-item:hover, .result-item.active{ background: rgba(0,0,0,.05); }
:root[data-theme="dark"] .result-item:hover,
:root[data-theme="dark"] .result-item.active{ background: rgba(255,255,255,.06); }

/* анимации как были */
.overlay-fade-enter-active, .overlay-fade-leave-active{ transition: opacity .18s ease; }
.overlay-fade-enter-from, .overlay-fade-leave-to{ opacity: 0; }
.panel-slide-enter-active, .panel-slide-leave-active{ transition: transform .22s ease, opacity .22s ease; }
.panel-slide-enter-from{ transform: translateY(-8px); opacity: 0; }
.panel-slide-leave-to{ transform: translateY(-8px); opacity: 0; }

/* мобильные — полноэкранная панель */
@media (max-width: 640px) {
    .search-panel{
        width: 100%; margin: 0; height: 100vh; border-radius: 0;
    }
    .result-list{ max-height: calc(100vh - 60px); }
}
</style>

