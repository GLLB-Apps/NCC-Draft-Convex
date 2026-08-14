import { useEffect, useRef, useState } from 'react'
import Dropzone from './Dropzone'
import { createSessionJwt } from '../../lib/supabase'

// Hämtar texten ur en PDF och lämnar tillbaka den som markdown, redo att läggas
// in i MD-läget. Själva konverteringen sker i api/pdf2md.py — den bygger på
// PyMuPDF, som inte kan köras i webbläsaren.
//
// PDF:en laddas först upp till Appwrite (samma storage som editorns övriga
// filer) och funktionen hämtar den därifrån. Sedan konverteras några sidor per
// anrop: varje svar säger vilken sida som står på tur, vilket både håller
// anropen korta och ger en progressbar som räknar riktiga sidor.

/** Sidor per anrop. Fler = färre anrop men längre väntan mellan stegen. */
const PAGE_BATCH = 8

interface Progress {
  phase: 'uploading' | 'converting' | 'done'
  done: number
  total: number
}

interface Response {
  pages: number
  headers: Record<string, unknown>
  markdown: string
  next: number | null
  error?: string
}

interface Props {
  onImported: (markdown: string, fileName: string) => void
  onClose: () => void
}

export default function PdfImportDialog({ onImported, onClose }: Props) {
  const [progress, setProgress] = useState<Progress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const cancelledRef = useRef(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !progress) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [progress, onClose])

  // Avbryter ett pågående anrop om rutan stängs mitt i.
  useEffect(() => () => { cancelledRef.current = true; abortRef.current?.abort() }, [])

  async function convert(url: string, file: File) {
    setError(null)
    cancelledRef.current = false
    setProgress({ phase: 'converting', done: 0, total: 1 })

    try {
      const jwt = await createSessionJwt()
      const parts: string[] = []
      let start: number | null = 0
      let headers: Record<string, unknown> | null = null

      while (start != null && !cancelledRef.current) {
        const controller = new AbortController()
        abortRef.current = controller
        const res = await fetch('/api/pdf2md', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
          body: JSON.stringify({ url, start, count: PAGE_BATCH, headers }),
          signal: controller.signal,
        })
        const data = await res.json().catch(() => ({})) as Response
        if (!res.ok) throw new Error(data.error || `Servern svarade ${res.status}`)

        parts.push(data.markdown)
        headers = data.headers
        const from: number = start
        start = data.next
        setProgress({ phase: 'converting', done: start ?? data.pages, total: data.pages })
        // Tomt svar på hela dokumentet betyder oftast en skannad PDF.
        if (start == null && from === 0 && !parts.join('').trim()) {
          throw new Error('PDF:en innehåller ingen text att hämta. Är den inskannad behöver den OCR-tolkas först.')
        }
      }

      if (cancelledRef.current) return
      setProgress({ phase: 'done', done: 1, total: 1 })
      onImported(parts.join('\n\n').trim(), file.name)
    } catch (e) {
      if (cancelledRef.current || (e instanceof DOMException && e.name === 'AbortError')) return
      setError(e instanceof Error ? e.message : String(e))
      setProgress(null)
    }
  }

  const percent = progress && progress.total > 0
    ? Math.round((progress.done / progress.total) * 100)
    : 0
  const busy = progress != null

  return (
    <div className="admin-modal-backdrop" onClick={() => !busy && onClose()}>
      <div className="admin-modal" role="dialog" aria-modal="true" aria-label="Hämta text från PDF" onClick={e => e.stopPropagation()}>
        <div className="admin-modal-head">
          <h3>Hämta text från PDF</h3>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            {busy ? 'Avbryt' : 'Stäng'}
          </button>
        </div>

        {busy ? (
          <div className="pdf-import-progress">
            <div className="pdf-import-bar">
              <div className="pdf-import-bar-fill" style={{ width: `${percent}%` }} />
            </div>
            <p className="form-hint">
              {progress.phase === 'converting' && progress.total > 1
                ? `Läser sida ${progress.done} av ${progress.total}…`
                : 'Läser dokumentet…'}
            </p>
          </div>
        ) : (
          <Dropzone
            accept=".pdf,application/pdf"
            label="Dra och släpp PDF:en här"
            hint="eller klicka för att välja"
            onUploaded={(url, file) => {
              setProgress({ phase: 'uploading', done: 0, total: 1 })
              return convert(url, file)
            }}
            onError={msg => setError('Uppladdningen misslyckades: ' + msg)}
          />
        )}

        {error && <p className="form-hint form-hint-warning">{error}</p>}

        <p className="form-hint">
          Rubriker, stycken, listor och tabeller följer med som block. Bilder och
          ritningar gör det inte — dem lägger du in själv. Är PDF:en inskannad
          finns ingen text att hämta.
        </p>
      </div>
    </div>
  )
}
