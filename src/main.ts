import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import './app.css'
import Shell from './components/Shell.vue'
import { useColumnsStore } from '@/store/columns'

const app = createApp(Shell)
const pinia = createPinia()
app.use(pinia)
app.use(router)

const columnsStore = useColumnsStore(pinia)
columnsStore.initFromStorage()

// ⬇️ дождёмся, пока роутер прочитает URL (в т.ч. /n/slug1/slug2/slug3)
router.isReady().then(() => {
    app.mount('#app')
})
