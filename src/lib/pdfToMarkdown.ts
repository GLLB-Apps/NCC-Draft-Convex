// PDF → Markdown, helt i webbläsaren med pdf.js.
//
// pdf.js lämnar ifrån sig textbitar med position och storlek, inte stycken och
// rubriker. Här sätts de ihop igen: bitar på samma rad blir en rad, rader utan
// luft emellan blir ett stycke, och teckenstorleken avgör vad som är rubrik.
//
// Rubrikgissningen följer samma idé som skrivbordsverktyget pdf2md: den
// vanligaste teckenstorleken (räknat i tecken, inte rader) är brödtext, och
// varje större storlek blir en rubriknivå uppifrån och ned.
//
// Vad som inte följer med:
//   • Tabeller. pdf.js känner inte igen tabellstruktur — en tabell är bara text
//     på bestämda positioner. Raderna kommer med som text.
//   • Bilder, diagram och ritningar. De är grafik i filen, inte tecken.
//   • Inskannade dokument, som saknar text helt och hållet.

export interface PdfProgress {
  page: number
  pages: number
}

export interface PdfOptions {
  onProgress?: (progress: PdfProgress) => void
  /** Kollas mellan sidorna; returnerar true avbryts läsningen. */
  isCancelled?: () => boolean
}

/** En textrad på en sida, med det som behövs för att tolka den. */
interface Line {
  text: string
  size: number
  /** pdf.js interna typsnittsnamn. Byte av typsnitt = fet stil eller annan font. */
  font: string
  /** Avståndet ned från raden ovanför, i punkter. Stort = ny tanke. */
  gapAbove: number
  /** Raden står i sidans över- eller underkant, där sidhuvud/sidfot bor. */
  margin: boolean
}

/** En sida som den kommer från pdf.js. Höjden behövs för att hitta marginalerna. */
export interface PdfPage {
  items: TextItem[]
  height: number
}

/** Det pdf.js lämnar ifrån sig per textbit — bara fälten som används här. */
export interface TextItem {
  str: string
  transform: number[]
  width: number
  height: number
  hasEOL: boolean
  fontName?: string
}

// Mellanrum bredare än så (andel av teckenstorleken) är ett mellanslag.
const SPACE_GAP = 0.25
// Radavstånd större än så (andel av teckenstorleken) bryter stycket.
const PARAGRAPH_GAP = 1.7
// Hur mycket större än brödtexten en storlek måste vara för att vara rubrik.
// Relativt, inte en fast gräns: i ett dokument med 10-punkters brödtext är en
// 12-punkters rad en rubrik, i ett med 12-punkters är den brödtext.
const HEADING_RATIO = 1.08
// Rubriker är korta. En storlek vars rader i snitt är längre än så är brödtext,
// hur stor den än är — annars blir "lite större brödtext" en hög med rubriker.
const HEADING_MAX_LENGTH = 100
const MAX_HEADING_LEVELS = 6
// Används bara när dokumentet saknar text att mäta på.
const FALLBACK_SIZE = 12
// Rader som återkommer på så stor andel av sidorna är sidhuvud/sidfot.
const RUNNING_HEAD_SHARE = 0.6
// Hur stor del av sidan upptill och nedtill som räknas som marginal.
const MARGIN_SHARE = 0.08
// Punkttecken varierar med typsnittet: •, ·, ▪ och streck är alla vanliga.
const BULLET = /^[-–—•·∙▪▫◦‣*]\s+(.*)$/

/** Laddas först när någon faktiskt importerar en PDF — biblioteket är stort. */
async function loadPdfjs() {
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ])
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  return pdfjs
}

export async function pdfToMarkdown(file: File | ArrayBuffer, options: PdfOptions = {}): Promise<string> {
  const pdfjs = await loadPdfjs()
  const data = file instanceof File ? await file.arrayBuffer() : file
  const task = pdfjs.getDocument({ data: new Uint8Array(data) })
  const doc = await task.promise

  try {
    const pages: PdfPage[] = []
    for (let number = 1; number <= doc.numPages; number++) {
      if (options.isCancelled?.()) break
      const page = await doc.getPage(number)
      try {
        const content = await page.getTextContent()
        pages.push({ items: content.items as TextItem[], height: page.getViewport({ scale: 1 }).height })
      } finally {
        page.cleanup()
      }
      options.onProgress?.({ page: number, pages: doc.numPages })
    }

    return pagesToMarkdown(pages)
  } finally {
    // Stänger arbetstråden pdf.js startade; utan det ligger den kvar.
    await task.destroy()
  }
}

/**
 * Textbitarna från pdf.js, en lista per sida → markdown. Skild från själva
 * pdf.js-anropen för att kunna köras och testas utan webbläsare.
 */
export function pagesToMarkdown(pages: PdfPage[]): string {
  const lines = withoutRunningHeads(pages.map(page => linesOnPage(page.items, page.height)))
  return tidy(assemble(lines, readLayout(lines)))
}

/** Sätter ihop pdf.js textbitar till rader, i läsordning. */
function linesOnPage(items: TextItem[], height: number): Line[] {
  const rows: { text: string; size: number; font: string; top: number }[] = []
  let current: { parts: string[]; size: number; font: string; top: number; right: number } | null = null

  const flush = () => {
    if (!current) return
    const text = current.parts.join('').replace(/\s+/g, ' ').trim()
    if (text) rows.push({ text, size: current.size, font: current.font, top: current.top })
    current = null
  }

  for (const item of items) {
    const size = Math.hypot(item.transform[2], item.transform[3]) || item.height || FALLBACK_SIZE
    const left = item.transform[4]
    const top = item.transform[5]

    if (!item.str) {
      if (item.hasEOL) flush()
      continue
    }
    // Ny rad när baslinjen flyttat sig, annars fortsätter samma rad.
    if (!current || Math.abs(top - current.top) > size * 0.5) {
      flush()
      current = { parts: [], size, font: item.fontName ?? '', top, right: left }
    }
    // pdf.js delar ofta upp en rad i bitar utan mellanslag emellan. Är det
    // luft mellan bitarna hörde det till texten.
    if (current.parts.length && left - current.right > size * SPACE_GAP) current.parts.push(' ')
    current.parts.push(item.str)
    current.size = Math.max(current.size, size)
    current.right = left + item.width
    if (item.hasEOL) flush()
  }
  flush()

  // Sidhuvud och sidfot står i marginalerna. Att i stället gå på "första och
  // sista raden" tar brödtext med sig när en sida börjar eller slutar mitt i.
  // pdf.js mäter y nedifrån, så stora värden är överkanten.
  const margin = Math.max(36, height * MARGIN_SHARE)
  return rows.map((row, i) => ({
    text: row.text,
    size: row.size,
    font: row.font,
    gapAbove: i === 0 ? Number.POSITIVE_INFINITY : Math.abs(rows[i - 1].top - row.top),
    margin: height > 0 && (row.top <= margin || row.top >= height - margin),
  }))
}

const normalise = (text: string) => text.replace(/\d+/g, '#').replace(/\s+/g, ' ').trim().toLowerCase()
const isPageNumber = (text: string) => /^[\s|–-]*(sid[ao]?|page)?[\s.]*\d+\s*(\(\d+\))?[\s|–-]*$/i.test(text)

/**
 * Tar bort sidhuvuden och sidfötter. De står överst eller nederst på varje sida
 * och skulle annars dyka upp som en rad text mitt i brödtexten var sida.
 */
function withoutRunningHeads(pages: Line[][]): Line[] {
  const seen = new Map<string, number>()
  for (const page of pages) {
    const edges = new Set(page.filter(line => line.margin).map(line => normalise(line.text)))
    for (const text of edges) seen.set(text, (seen.get(text) ?? 0) + 1)
  }
  const repeated = new Set(
    [...seen].filter(([, count]) => pages.length >= 3 && count >= pages.length * RUNNING_HEAD_SHARE)
      .map(([text]) => text),
  )

  return pages.flatMap(page =>
    page.filter(line => !(line.margin && (repeated.has(normalise(line.text)) || isPageNumber(line.text)))),
  )
}

/**
 * Hur dokumentet är satt: vilken storlek och vilket typsnitt som är brödtext,
 * och vilka storlekar som är rubriker.
 *
 * Storleken räcker inte alltid. Många dokument har rubriker i samma storlek som
 * brödtexten, bara feta — och fet stil syns inte i pdf.js (fontFamily säger
 * "sans-serif" för allt). Däremot får varje typsnitt ett eget internt namn, så
 * en kort rad satt i ett annat typsnitt än brödtexten är med stor sannolikhet
 * en rubrik även om den är lika stor.
 */
interface Layout {
  levels: Map<number, number>
  bodySize: number
  bodyFont: string
}

function readLayout(lines: Line[]): Layout {
  const chars = new Map<number, number>()
  const lengths = new Map<number, number[]>()
  const fonts = new Map<string, number>()

  for (const line of lines) {
    const size = Math.round(line.size)
    chars.set(size, (chars.get(size) ?? 0) + line.text.length)
    lengths.set(size, [...(lengths.get(size) ?? []), line.text.length])
    fonts.set(line.font, (fonts.get(line.font) ?? 0) + line.text.length)
  }

  const most = <T,>(counts: Map<T, number>, fallback: T): T => {
    let best = fallback
    let top = 0
    for (const [key, count] of counts) if (count > top) { top = count; best = key }
    return best
  }

  const bodySize = most(chars, FALLBACK_SIZE)
  const bodyFont = most(fonts, '')

  const levels = new Map<number, number>()
  const candidates = [...chars.keys()]
    .filter(size => size >= bodySize * HEADING_RATIO)
    // Långa rader är brödtext även när de är stora, t.ex. ingresser.
    .filter(size => {
      const all = lengths.get(size) ?? []
      return all.reduce((sum, n) => sum + n, 0) / all.length <= HEADING_MAX_LENGTH
    })
    .sort((a, b) => b - a)

  candidates.slice(0, MAX_HEADING_LEVELS).forEach((size, index) => levels.set(size, index + 1))
  return { levels, bodySize, bodyFont }
}

/**
 * Nivån för en rad, eller 0 för brödtext. Storlek först; annars en kort rad i
 * ett avvikande typsnitt, som läggs en nivå under de storleksbaserade.
 */
function levelOf(line: Line, layout: Layout): number {
  const bySize = layout.levels.get(Math.round(line.size))
  if (bySize) return bySize

  const emphasised = line.font !== layout.bodyFont && Math.round(line.size) >= layout.bodySize
  const short = line.text.length <= HEADING_MAX_LENGTH && !/[.:,;]$/.test(line.text)
  if (emphasised && short) return Math.min(layout.levels.size + 1, MAX_HEADING_LEVELS)
  return 0
}

/** Rader → markdown-block: rubrik, punktlista eller stycke. */
function assemble(lines: Line[], layout: Layout): string {
  const out: string[] = []
  let paragraph: string[] = []

  const flush = () => {
    const text = paragraph.join(' ').replace(/\s+/g, ' ').trim()
    if (text) out.push(text)
    paragraph = []
  }

  for (const line of lines) {
    const level = levelOf(line, layout)
    const bullet = BULLET.exec(line.text)

    if (level) {
      flush()
      out.push('#'.repeat(level) + ' ' + line.text)
    } else if (bullet) {
      flush()
      const item = '- ' + bullet[1].trim()
      // Punkter efter varandra hör till samma lista, inte till var sitt block.
      const last = out[out.length - 1]
      if (last?.startsWith('- ')) out[out.length - 1] = last + '\n' + item
      else out.push(item)
    } else {
      if (paragraph.length && line.gapAbove > line.size * PARAGRAPH_GAP) flush()
      const previous = paragraph[paragraph.length - 1]
      // Avstavning över radbrytning: "fastig-" + "heten" → "fastigheten".
      if (previous?.endsWith('-') && /^[a-zåäö]/.test(line.text)) {
        paragraph[paragraph.length - 1] = previous.slice(0, -1) + line.text
      } else {
        paragraph.push(line.text)
      }
    }
  }
  flush()

  return out.join('\n\n')
}

/** Sista städningen, samma som pdf2md gör på sin råoutput. */
function tidy(markdown: string): string {
  return markdown
    .split('\n')
    .map(line => line.replace(/\*\*|__/g, '').trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim() + '\n'
}
