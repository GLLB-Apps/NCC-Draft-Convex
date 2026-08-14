import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    // Guarantee a single React instance in the bundle/dev graph
    // (prevents "Invalid hook call" / duplicate-React issues).
    resolve: {
      dedupe: ['react', 'react-dom'],
    },
    server: {
      // `npm run dev` serverar bara frontend — /api finns inte, så kontaktformulär
      // och administratörsrättigheter går inte att prova lokalt. Sätt API_PROXY i
      // .env.local till en deployad sajt (t.ex. en Vercel-preview) så går
      // api-anropen dit, utan att `vercel dev` behöver köras.
      //
      //   API_PROXY=https://ncc-draft-rs-git-min-gren.vercel.app
      proxy: env.API_PROXY
        ? { '/api': { target: env.API_PROXY, changeOrigin: true } }
        : undefined,
    },
  }
})
