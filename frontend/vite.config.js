import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// HU7 / RNF4: la aplicación se instala como PWA en el celular.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      // La API no es parte de la aplicación: abrir una ruta /api (por ejemplo,
      // el contrato OpenAPI de la integración, HU22) no debe devolver la app.
      workbox: { navigateFallbackDenylist: [/^\/api\//] },
      manifest: {
        name: 'Remitto',
        short_name: 'Remitto',
        description: 'Tu stock al día, con una foto del remito.',
        lang: 'es',
        start_url: '/',
        display: 'standalone',
        background_color: '#F2E9D8',
        theme_color: '#4E6A4B',
        // Logo de favicon.svg. El maskable ocupa todo el cuadrado (sin esquinas
        // redondeadas) con el remito dentro de la zona segura, porque Android
        // lo recorta con la forma del lanzador.
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      // Redirige las llamadas /api al backend en desarrollo.
      '/api': 'http://localhost:4000',
    },
  },
});
