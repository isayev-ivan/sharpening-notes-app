import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import './app.css'
import Shell from './components/Shell.vue'

const app = createApp(Shell)
app.use(createPinia())
app.use(router)
app.mount('#app')
