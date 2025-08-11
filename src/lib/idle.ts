// Неблокирующая "ленивая" очередь работ на idle-слотах браузера
export type IdleDeadline = { timeRemaining(): number; didTimeout?: boolean }
type IdleCb = (deadline: IdleDeadline) => void

const ric: (cb: IdleCb) => number =
    typeof window !== 'undefined' && 'requestIdleCallback' in window
        ?
        window.requestIdleCallback
        : (cb: IdleCb) => window.setTimeout(() => cb({ timeRemaining: () => 0 }), 0)

/** Запускает обработку очереди небольшими порциями, пока есть "свободное" время. */
export function runIdleQueue(step: () => boolean, minTime = 6) {
    function tick(deadline: IdleDeadline) {
        while (deadline.timeRemaining() > minTime) {
            const hasMore = step()
            if (!hasMore) return
        }
        ric(tick)
    }
    ric(tick)
}

/** Просто вызвать колбэк в ближайший idle-слот. */
export function requestIdle(cb: IdleCb) {
    return ric(cb)
}
