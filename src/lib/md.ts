import MarkdownIt from 'markdown-it'
import { wikiLinksPlugin } from './wikiLinks'

export const md = new MarkdownIt({
    html: false,      // чтобы не исполнять сырой HTML из заметок
    linkify: true,
    typographer: true,
})

md.use(wikiLinksPlugin)
