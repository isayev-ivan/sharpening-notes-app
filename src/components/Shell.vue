<script setup lang="ts">
import { onMounted } from 'vue'
import { useColumnsStore } from '@/store/columns'
import { getManifest } from '@/lib/notes'
import Column from './Column.vue'

const columns = useColumnsStore()

onMounted(async () => {
    columns.ensureAtLeastOne()
    const manifest = await getManifest()
    const home = manifest.find(m => m.path.endsWith('/home.md'))
    const initial = home ?? manifest[0]
    if (initial) {
        columns.setSlugAt(0, initial.slug)
    }
})
</script>

<template>
    <div class="app-shell">
        <Column
            v-for="(c, i) in columns.columns"
            :key="i + ':' + c.slug"
            :slug="c.slug"
            :index="i"
            :can-close="columns.columns.length > 1"
        />
    </div>
</template>

<style>
/* стили в app.css */
</style>
