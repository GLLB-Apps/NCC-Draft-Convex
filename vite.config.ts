import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Guarantee a single React instance in the bundle/dev graph
  // (prevents "Invalid hook call" / duplicate-React issues).
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
})
