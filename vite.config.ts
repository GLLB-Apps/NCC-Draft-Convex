import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
//
// Inget /api-proxybehov som i Appwrite-/PHP-versionerna — klienten pratar
// direkt med Convex-deploymenten via VITE_CONVEX_URL, oavsett om `npm run
// dev` körs lokalt eller mot produktion. Se .env.example.
export default defineConfig({
  plugins: [react()],
  // Guarantee a single React instance in the bundle/dev graph
  // (prevents "Invalid hook call" / duplicate-React issues).
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
})
