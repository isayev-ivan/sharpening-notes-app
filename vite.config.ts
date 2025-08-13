import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'
import { VitePWA } from 'vite-plugin-pwa'
import notesPlugin from './plugins/notesPlugin'

export default defineConfig(({ mode }) => {
  // Для GitHub Pages в Actions мы пробрасываем VITE_BASE="/<repo>/"
  const base = process.env.VITE_BASE || '/'

  return {
    base,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    plugins: [
      vue(),
      notesPlugin(),

      // PWA / offline
      VitePWA({
        registerType: 'autoUpdate',
        // В dev-превью SW работает (npm run preview). Можно включить и в dev-сервере:
        // devOptions: { enabled: true, type: 'module' },
        includeAssets: ['favicon.svg', 'robots.txt'],
        manifest: {
          name: 'Evergreen Notes',
          short_name: 'Notes',
          description: 'Вечно-зелёные заметки',
          theme_color: '#0b57d0',
          background_color: '#ffffff',
          display: 'standalone',
          start_url: '.',
          scope: '.',
          icons: [
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
          navigateFallback: 'index.html',
          cleanupOutdatedCaches: true,
          runtimeCaching: [
            {
              // пример: внешние шрифты/CDN (если появятся)
              urlPattern: ({ url }) =>
                  url.origin !== self.location.origin &&
                  /(\.woff2?|fonts\.|gstatic\.com|unpkg\.com|jsdelivr\.net)/.test(url.href),
              handler: 'CacheFirst',
              options: {
                cacheName: 'ext-fonts',
                expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 * 24 * 365 },
              },
            },
          ],
        },
      }),
    ],

    // опционально: порт dev-сервера/прочее
    server: {
      port: 5173,
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
  }
})
