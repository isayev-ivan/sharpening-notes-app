<script setup lang="ts">
import { onMounted } from 'vue'
import { useColumnsStore } from '@/store/columns'
import Column from './Column.vue'

const columns = useColumnsStore()

onMounted(() => {
    columns.ensureAtLeastOne()
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
