import { defineConfig } from 'vite';

// Base GitHub Pages : dépôt `pid-game` (registre, décision D11).
export default defineConfig({
  base: '/pid-game/',
  build: {
    target: 'es2023',
  },
});
