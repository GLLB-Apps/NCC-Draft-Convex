import { usePage } from '../../lib/usePage'

// Renders a public page's editable title + intro (managed under Admin → Sidor).
// Meant to sit inside an existing `.page-header` container.
export default function PageHeader({ slug }: { slug: string }) {
  const page = usePage(slug)
  return (
    <>
      <h1>{page.title}</h1>
      {page.intro && <p>{page.intro}</p>}
    </>
  )
}
