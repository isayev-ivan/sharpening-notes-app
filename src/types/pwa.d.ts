declare module 'virtual:pwa-register' {
    export interface RegisterSWOptions {
        immediate?: boolean
        onNeedRefresh?: () => void
        onOfflineReady?: () => void
        onRegistered?: (r: ServiceWorkerRegistration | undefined) => void
        onRegisteredSW?: (swUrl: string, r: ServiceWorkerRegistration | undefined) => void
        onRegisterError?: (err: any) => void
    }
    export function registerSW(opts?: RegisterSWOptions): (reload?: boolean) => Promise<void>
}
