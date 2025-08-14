import { onBeforeUnmount, ref } from 'vue'
import { ANIM } from '@/lib/anim'

export function useProgressiveReveal() {
    const showLoader = ref(false)      // показывать ли лоадер
    const contentVisible = ref(false)  // показывать ли контент (с анимацией)

    let loaderTimer: number | null = null
    let minTimer: number | null = null
    let loaderShownAt = 0
    let contentReady = false

    function clearTimers() {
        if (loaderTimer) { clearTimeout(loaderTimer); loaderTimer = null }
        if (minTimer) { clearTimeout(minTimer); minTimer = null }
    }

    /** начать новый цикл показа (перед стартом загрузки контента) */
    function begin() {
        clearTimers()
        showLoader.value = false
        contentVisible.value = false
        contentReady = false
        loaderShownAt = 0

        // Через loaderDelay показываем лоадер, если контент ещё НЕ готов
        loaderTimer = window.setTimeout(() => {
            loaderTimer = null
            if (contentReady) {
                // контент уже готов — лоадер не нужен, показываем сразу
                contentVisible.value = true
                return
            }
            showLoader.value = true
            loaderShownAt = performance.now()
            // минимальная длительность показа лоадера
            minTimer = window.setTimeout(() => {
                minTimer = null
                if (contentReady) {
                    contentVisible.value = true
                    showLoader.value = false
                }
            }, ANIM.loaderMin)
        }, ANIM.loaderDelay)
    }

    /** отметить, что контент загрузился */
    function done() {
        contentReady = true

        // если таймер лоадера ещё не сработал — отменяем его и показываем контент сразу
        if (loaderTimer) {
            clearTimeout(loaderTimer)
            loaderTimer = null
            if (!showLoader.value) {
                contentVisible.value = true
                return
            }
        }

        // если лоадер уже показан — дожидаемся минималки
        if (showLoader.value) {
            const elapsed = performance.now() - loaderShownAt
            const remaining = Math.max(ANIM.loaderMin - elapsed, 0)
            if (remaining <= 0) {
                contentVisible.value = true
                showLoader.value = false
            } else {
                minTimer = window.setTimeout(() => {
                    contentVisible.value = true
                    showLoader.value = false
                    minTimer = null
                }, remaining)
            }
        } else {
            // защитный случай: лоадер не показан и таймера уже нет — показываем сразу
            contentVisible.value = true
        }
    }

    /** отменить текущий цикл (например, при смене slug) */
    function reset() {
        clearTimers()
        showLoader.value = false
        contentVisible.value = false
        contentReady = false
        loaderShownAt = 0
    }

    onBeforeUnmount(clearTimers)
    return { showLoader, contentVisible, begin, done, reset }
}
