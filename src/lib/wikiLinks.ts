import type MarkdownIt from 'markdown-it'

type WikiEnv = {
    resolve?: (name: string) => string | null
    outgoing?: string[]
}

export function wikiLinksPlugin(md: MarkdownIt) {
    // Встраиваемся в inline-парсер до emphasis
    md.inline.ruler.before('emphasis', 'wikilinks', (state, silent) => {
        const start = state.pos
        const max = state.posMax

        // Должно начинаться с [[
        if (state.src.charCodeAt(start) !== 0x5B/*[*/ || start + 1 >= max || state.src.charCodeAt(start + 1) !== 0x5B/*[*/)
            return false

        // Ищем закрывающие ]]
        let pos = start + 2
        while (pos < max) {
            if (state.src.charCodeAt(pos) === 0x5D/*]*/ && pos + 1 < max && state.src.charCodeAt(pos + 1) === 0x5D/*]*/) {
                break
            }
            pos++
        }
        if (pos >= max) return false // не нашли ]]

        if (!silent) {
            const raw = state.src.slice(start + 2, pos).trim()
            // Разбор "Название | текст" или "Название"
            let target = raw
            let text = raw
            const pipeIdx = raw.indexOf('|')
            if (pipeIdx !== -1) {
                target = raw.slice(0, pipeIdx).trim()
                text = raw.slice(pipeIdx + 1).trim()
            }

            const env = state.env as WikiEnv
            const slug = env.resolve ? env.resolve(target) : null
            const isMissing = !slug
            const href = '#' // не навигируем якорем — кликом управляет JS

            // Токены <a>
            const tokenOpen = state.push('link_open', 'a', 1)
            tokenOpen.attrSet('href', href)
            tokenOpen.attrJoin('class', 'wikilink')
            if (slug) tokenOpen.attrSet('data-slug', slug)
            if (isMissing) tokenOpen.attrJoin('class', 'is-missing')
            tokenOpen.attrSet('data-missing', isMissing ? 'true' : 'false')
            tokenOpen.markup = '[['

            const tokenText = state.push('text', '', 0)
            tokenText.content = text

            const tokenClose = state.push('link_close', 'a', -1)
            tokenClose.markup = ']]'

            // собираем исходящие ссылки в env
            if (!isMissing) {
                if (!env.outgoing) env.outgoing = []
                env.outgoing.push(slug!)
            }
        }

        state.pos = pos + 2 // перепрыгиваем ]]
        return true
    })
}
