import type MarkdownIt from 'markdown-it'

export type WikiEnv = {
    resolve?: (name: string) => string | null
    isAmbiguous?: (name: string) => boolean
    outgoing?: string[]
}

export type WikiLinksOptions = {
    resolve?: (name: string) => string | null
    isAmbiguous?: (name: string) => boolean
    getAmbiguityList?: (name: string) => string
}

/**
 * [[Название]] и [[Название | отображаемый текст]]
 * - href = '#', клики обрабатывает приложение
 * - data-slug = канонический slug (если найден)
 * - .is-missing для битых
 * - .is-ambiguous + data-amb-list для двусмысленных (CSS-тултип)
 */
export function wikiLinksPlugin(md: MarkdownIt, opts: WikiLinksOptions = {}) {
    md.inline.ruler.before('emphasis', 'wikilinks', (state, silent) => {
        const start = state.pos
        const max = state.posMax

        if (
            state.src.charCodeAt(start) !== 0x5b /* [ */ ||
            start + 1 >= max ||
            state.src.charCodeAt(start + 1) !== 0x5b /* [ */
        ) return false

        let pos = start + 2
        while (pos < max) {
            if (
                state.src.charCodeAt(pos) === 0x5d /* ] */ &&
                pos + 1 < max &&
                state.src.charCodeAt(pos + 1) === 0x5d /* ] */
            ) break
            pos++
        }
        if (pos >= max) return false

        if (!silent) {
            const raw = state.src.slice(start + 2, pos).trim()

            let target = raw
            let label = raw
            const pipeIdx = raw.indexOf('|')
            if (pipeIdx !== -1) {
                target = raw.slice(0, pipeIdx).trim()
                label = raw.slice(pipeIdx + 1).trim()
            }

            const env = state.env as WikiEnv
            const resolve = env.resolve ?? opts.resolve
            const isAmbiguous = env.isAmbiguous ?? opts.isAmbiguous

            const slug = resolve ? resolve(target) : null
            const missing = !slug
            const ambiguous = !missing && !!(isAmbiguous && isAmbiguous(target))
            const href = '#'

            const open = state.push('link_open', 'a', 1)
            open.attrSet('href', href)
            open.attrJoin('class', 'wikilink')
            open.attrSet('data-missing', missing ? 'true' : 'false')
            if (slug) open.attrSet('data-slug', slug)
            if (missing) open.attrJoin('class', 'is-missing')
            if (ambiguous) {
                open.attrJoin('class', 'is-ambiguous')
                const list = opts.getAmbiguityList ? opts.getAmbiguityList(target) : ''
                if (list) open.attrSet('data-amb-list', list)
            }
            open.markup = '[['

            const text = state.push('text', '', 0)
            text.content = label

            const close = state.push('link_close', 'a', -1)
            close.markup = ']]'

            if (!missing) (env.outgoing ||= []).push(slug!)
        }

        state.pos = pos + 2
        return true
    })
}
