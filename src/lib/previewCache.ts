let cache: Map<string, string> | undefined
export function usePreviewCache() {
    return (cache ??= new Map<string, string>())
}
