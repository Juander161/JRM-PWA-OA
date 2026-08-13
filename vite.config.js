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
});
