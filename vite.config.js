import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
  },
  // Rutas relativas: así el build funciona igual servido desde la raíz del
  // dominio o desde un subdirectorio, sin recompilar.
  base: './',
  build: {
    rollupOptions: {
      output: {
        // Nombres de archivo FIJOS, sin hash. Vital para que la app funcione
        // sin red: con hash, al publicar una versión nueva el index.html
        // guardado en caché apunta a archivos con nombres que ya no existen
        // en la caché, y la app queda rota justo cuando no hay conexión para
        // descargarlos. Con nombres estables eso no puede pasar — el service
        // worker siempre encuentra lo que el HTML pide.
        entryFileNames: 'assets/app.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
});
