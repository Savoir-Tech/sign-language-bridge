import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000',
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
        configure: (proxy) => {
          const originalEmit = proxy.emit.bind(proxy);
          proxy.emit = (event: string, ...args: unknown[]) => {
            if (event === 'error') {
              const err = args[0] as NodeJS.ErrnoException | undefined;
              if (err?.code === 'ECONNRESET' || err?.message === 'socket hang up') {
                return false;
              }
            }
            return originalEmit(event, ...args);
          };
        },
      },
    },
  },
})
