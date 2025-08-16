// src/types/workbox-shim.d.ts
// Позволяет сторонним d.ts не падать, когда нет lib.webworker

interface ExtendableEvent extends Event {
    waitUntil(promise: Promise<unknown>): void
}

interface ServiceWorkerGlobalScope extends WorkerGlobalScope {
    // расширения по необходимости
}

declare var self: Window & typeof globalThis | ServiceWorkerGlobalScope
