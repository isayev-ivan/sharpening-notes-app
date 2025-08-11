import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import notesPlugin from './plugins/notesPlugin' // ⬅️

const base = process.env.VITE_BASE ?? '/'

export default defineConfig({
  base,
  plugins: [vue(), notesPlugin()], // ⬅️
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
  }
  // optimizeDeps: { include: ['buffer'] } // ⛔ удалить
})
