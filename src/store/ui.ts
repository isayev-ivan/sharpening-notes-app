import { defineStore } from 'pinia'

export const useUiStore = defineStore('ui', {
    state: () => ({
        searchOpen: false,
        helpOpen: false,
        activeIndex: 0,
    }),
    actions: {
        openSearch() { this.searchOpen = true },
        closeSearch() { this.searchOpen = false },
        toggleSearch() { this.searchOpen = !this.searchOpen },

        openHelp() { this.helpOpen = true },
        closeHelp() { this.helpOpen = false },
        toggleHelp() { this.helpOpen = !this.helpOpen },

        setActiveIndex(i: number) { this.activeIndex = Math.max(0, i) },
    }
})
