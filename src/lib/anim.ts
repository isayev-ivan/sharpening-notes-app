export const ANIM = {
    /** Через сколько показать лоадер, если контент ещё не готов, мс */
    loaderDelay: Number(import.meta.env.VITE_ANIM_LOADER_DELAY ?? 200),
    /** Минимальная длительность показа лоадера (если он уже показался), мс */
    loaderMin: Number(import.meta.env.VITE_ANIM_LOADER_MIN ?? 500),
    /** Задержка «ступеньки» между колонками слева направо, мс/колонка */
    stagger: Number(import.meta.env.VITE_ANIM_STAGGER ?? 80),
}
