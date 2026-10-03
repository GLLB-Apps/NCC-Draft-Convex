import { ConvexReactClient } from 'convex/react'

// En delad klientinstans — används både av providern i App.tsx (för
// useQuery/useAuthActions m.fl.) och av den imperativa supabase.ts-shimmen
// (ConvexReactClient.query()/.mutation(), utanför React-render, se
// MIGRATION_PLAN.md §4).
export const convexClient = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string)
