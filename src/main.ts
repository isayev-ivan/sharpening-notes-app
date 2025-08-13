import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import './app.css'
import Shell from './components/Shell.vue'
import { useColumnsStore } from '@/store/columns'
import { registerSW } from 'virtual:pwa-register'
import { initTheme } from '@/lib/theme'

initTheme() // применим тему ещё до рендера, чтобы не мигало

// Автообновление: при появлении новой версии сразу активируем её
const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
        // «тихое» обновление — активируем новую версию и перезагружаем
        void updateSW(true)  // «съели» промис
    },
    onOfflineReady() {
        // можно показать тост «готово к офлайну», если захочешь
        console.log('App ready for offline')
    }
})

const app = createApp(Shell)
const pinia = createPinia()
app.use(pinia)
app.use(router)

const columnsStore = useColumnsStore(pinia)
columnsStore.initFromStorage()

router.isReady().then(() => app.mount('#app'))
