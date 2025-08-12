import { defineStore } from 'pinia'

export const useUiStore = defineStore('ui', {
    state: () => ({ searchOpen: false }),
    actions: {
        openSearch() { this.searchOpen = true },
        closeSearch() { this.searchOpen = false },
        toggleSearch() { this.searchOpen = !this.searchOpen },
    }
})
