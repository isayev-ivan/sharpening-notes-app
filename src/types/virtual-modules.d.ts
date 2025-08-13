declare module 'virtual:notes-manifest' {
    const data: Array<{ slug: string; title: string; path: string }>;
    export default data;
}

declare module 'virtual:notes-graph' {
    const data: {
        outgoing: Record<string, string[]>;
        incoming: Record<string, string[]>;
        aliasMap: Record<string, string>;
        aliasesBySlug: Record<string, string[]>;
        aliasToSlugs: Record<string, string[]>;
        excerptsBySlug: Record<string, string>;
        descriptionsBySlug: Record<string, string>;
    };
    export default data;
}

declare module 'virtual:notes-check' {
    const data: {
        brokenLinks: { fromSlug: string; fromTitle: string; target: string; targetSlug: string }[];
        aliasConflicts: { alias: string; slugs: string[] }[];
    };
    export default data;
}
