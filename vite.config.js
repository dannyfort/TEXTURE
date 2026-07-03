import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        // three reste un chunk dédié : le tree-shaking ne gagne presque
        // rien (WebGLRenderer tire ~tout le package) et le chunk séparé,
        // chargé en différé par scenes/index.js, se met en cache à part
        manualChunks: {
          three: ['three'],
          gsap: ['gsap'],
        },
      },
    },
  },
});
