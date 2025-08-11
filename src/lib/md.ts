import MarkdownIt from 'markdown-it'
import { wikiLinksPlugin } from './wikiLinks'

export const md = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: true,
})

md.use(wikiLinksPlugin)

/**
 * Рендерит первые N абзацев, удаляя изображения.
 */
export function renderPreview(content: string, maxParagraphs = 3): string {
    const env: any = {}
    const tokens = md.parse(content, env)

    const out: any[] = []
    let paragraphs = 0
    let inPara = false

    for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i]

        if (t.type === 'paragraph_open') {
            if (paragraphs >= maxParagraphs) break
            inPara = true
            out.push(t)
            continue
        }
        if (t.type === 'paragraph_close') {
            inPara = false
            paragraphs++
            out.push(t)
            if (paragraphs >= maxParagraphs) break
            continue
        }

        if (inPara) {
            // копируем токен абзаца, фильтруя картинки внутри inline
            if (t.type === 'inline') {
                const clone = new (t as any).constructor()
                Object.assign(clone, t)
                clone.children = (t.children || []).filter((c: any) => c.type !== 'image')
                out.push(clone)
            } else if (t.type !== 'image') {
                out.push(t)
            }
        }
    }

    return md.renderer.render(out as any, md.options, env)
}
