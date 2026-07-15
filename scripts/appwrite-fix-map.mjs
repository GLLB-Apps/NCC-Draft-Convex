// Aligns the "residence_distance" map point with the new distance-line feature:
// the map now draws a dashed line to the nearest quarry and shows the computed
// distance, so the point's own text should not hard-code a (wrong) number.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Client, Databases, Query } from 'node-appwrite'

const __dirname = dirname(fileURLToPath(import.meta.url))
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !line.trim().startsWith('#')) process.env[m[1]] ??= m[2]
}
const client = new Client()
  .setEndpoint(process.env.VITE_APPWRITE_ENDPOINT)
  .setProject(process.env.VITE_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY)
const databases = new Databases(client)
const DB = process.env.VITE_APPWRITE_DATABASE_ID

const res = await databases.listDocuments({
  databaseId: DB, collectionId: 'map_locations',
  queries: [Query.equal('point_type', ['residence_distance'])],
})
for (const doc of res.documents) {
  await databases.updateDocument({
    databaseId: DB, collectionId: 'map_locations', documentId: doc.$id,
    data: {
      title: 'Närmaste bostäder – Södra Sandby',
      description: 'Här börjar bebyggelsen i Södra Sandby. Den streckade linjen på kartan visar ungefärligt avstånd härifrån till det planerade täktområdet.',
    },
  })
  console.log('✓ updated', doc.$id)
}
console.log(`Done (${res.total} point(s)).`)
