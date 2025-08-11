//базовый рендерер (пока без вики-плагина)
import MarkdownIt from 'markdown-it'

export const md = new MarkdownIt({
    html: false,      // чтобы не исполнять сырой HTML из заметок
    linkify: true,
    typographer: true,
})
