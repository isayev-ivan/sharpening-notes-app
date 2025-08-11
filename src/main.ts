import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import './app.css'
import Shell from './components/Shell.vue'
import { useColumnsStore } from '@/store/columns'
import { initTheme } from '@/lib/theme'   // ⬅️

initTheme() // ⬅️ применим тему ещё до рендера, чтобы не мигало

const app = createApp(Shell)
const pinia = createPinia()
app.use(pinia)
app.use(router)

const columnsStore = useColumnsStore(pinia)
columnsStore.initFromStorage()

router.isReady().then(() => app.mount('#app'))
