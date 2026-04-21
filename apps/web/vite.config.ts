import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4111',
        changeOrigin: true,
      },
      // Custom routes registered via registerApiRoute() live at root per Mastra docs.
      '/custom': {
        target: 'http://localhost:4111',
        changeOrigin: true,
      },
    },
  },
});
