declare module 'virtual:notes-manifest' {
    const data: Array<{ slug: string; title: string; path: string }>;
    export default data;
}

declare module 'virtual:notes-graph' {
    const data: {
        outgoing: Record<string, string[]>;
        incoming: Record<string, string[]>;
        aliasMap: Record<string, string>; // 👈 добавили
        aliasesBySlug: Record<string, string[]>; // 👈
    };
    export default data;
}
