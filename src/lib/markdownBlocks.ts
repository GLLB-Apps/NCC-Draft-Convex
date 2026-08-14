import type { ContentBlock } from './types'
import { headingLevel } from './utils'

// Markdown-läget i block-editorn: samma innehåll som blocken, fast som en enda
// text man kan klistra in, redigera och kopiera vidare. Konverteringen går åt
// båda hållen och ska vara rundgångssäker — allt som skrivs ut här ska kunna
// läsas tillbaka till samma block, så att ett byte till MD och tillbaka aldrig
// tappar innehåll.
//
// Vanlig markdown räcker för det mesta:
//
//   ## Rubrik              rubrik
//   text                   stycke (tom rad = nytt stycke)
//   > citat                citat
//   - punkt                punktlista
//   ---                    avdelare
//   ![alt](url "bildtext") bild
//   [Knapptext](url)       knapp (ensam på sin rad)
//
// De block som saknar motsvarighet i markdown skrivs som ett block mellan
// ::: -rader, t.ex.
//
//   :::fakta Rubriken
//   Brödtexten i rutan.
//   :::
//
// Toolbaren i editorn skriver in exakt de här formerna, så samma knapp ger
// samma resultat i båda lägena.

const IMAGE_LINE = /^!\[([^\]]*)\]\(\s*<?([^>\s)]+)>?(?:\s+"([^"]*)")?\s*\)$/
// Texten får vara tom — verktygsraden skriver in [](adress) och låter markören
// stå i hakparentesen, och raden ska räknas som en knapp redan innan man skrivit.
const LINK_LINE = /^\[([^\]]*)\]\(\s*<?([^>\s)]+)>?\s*\)$/
const BULLET = /^\s*[-*+]\s+(.*)$/
// Rubriker skrivs på flera sätt i markdown, och alla ska gå att klistra in:
//   # Rubrik          (nivå 1–6)
//   ## Rubrik ##      (med avslutande brädgårdar)
//   Rubrik            (understruken – = ger nivå 1, - ger nivå 2)
//   ======
// Ut skrivs alltid #-formen, så innehållet ser likadant ut varje gång.
const HEADING = /^(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/
const SETEXT = /^\s{0,3}(=+|-+)\s*$/
const QUOTE = /^>\s?(.*)$/
const RULE = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/
const DIRECTIVE_OPEN = /^:::\s*([\p{L}_-]+)\s*(.*)$/u
const DIRECTIVE_CLOSE = /^:::\s*$/

/** Namnet efter ::: → blocktyp. Flera stavningar tillåts vid inläsning. */
const DIRECTIVE_TYPE: Record<string, ContentBlock['type']> = {
  fakta: 'factbox', faktaruta: 'factbox', factbox: 'factbox',
  varning: 'warning', varningsruta: 'warning', warning: 'warning',
  uppmaning: 'cta', cta: 'cta',
  video: 'video',
  'källor': 'sources', kallor: 'sources', sources: 'sources',
  lista: 'list', list: 'list',
  resurs: 'resource', resource: 'resource',
  'länkar': 'links', lankar: 'links', links: 'links',
  'jämförelse': 'comparison', jamforelse: 'comparison', comparison: 'comparison',
}
/** Namnet som skrivs ut igen för respektive blocktyp. */
const TYPE_DIRECTIVE: Partial<Record<ContentBlock['type'], string>> = {
  factbox: 'fakta', warning: 'varning', cta: 'uppmaning',
  video: 'video', sources: 'källor', list: 'lista', resource: 'resurs',
  links: 'länkar', comparison: 'jämförelse',
}
/** Reserverat namn för block som inte har någon markdown-form alls. */
const JSON_DIRECTIVE = 'block'

/**
 * Plockar bort inline-markering ur text. Blocken lagrar ren text — utan detta
 * skulle inklistrad markdown visa "**fetstil**" och "[länk](url)" ordagrant på
 * sidan.
 */
function plainText(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    // Utan lookbehind – den saknas i äldre Safari och skulle få hela modulen
    // att sluta laddas.
    .replace(/(^|[^\w*])\*([^*\s][^*]*)\*(?!\w)/g, '$1$2')
    .replace(/(^|[^\w_])_([^_\s][^_]*)_(?!\w)/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .trim()
}

const directiveLine = (name: string, title?: string | null) =>
  `:::${name}${title?.trim() ? ' ' + title.trim() : ''}`

const linkLine = (label: string, url: string) => `[${label || 'Öppna'}](${url})`

function blockToMarkdown(block: ContentBlock): string {
  const text = block.text ?? ''
  switch (block.type) {
    case 'heading':
      return `${'#'.repeat(headingLevel(block.level))} ${text}`
    case 'paragraph':
      return text
    case 'quote':
      return text.split('\n').map(l => `> ${l}`).join('\n')
    case 'divider':
      return '---'
    case 'image': {
      const caption = text.trim() ? ` "${text.replace(/"/g, "'")}"` : ''
      return `![${block.alt_text ?? ''}](${block.image_url ?? ''}${caption})`
    }
    case 'button':
      return linkLine(text, block.url ?? '')
    case 'list': {
      const items = (block.items ?? []).map(it => `- ${it}`)
      if (!block.title?.trim()) return items.join('\n')
      return [directiveLine('lista', block.title), ...items, ':::'].join('\n')
    }
    case 'factbox':
    case 'warning':
      return [directiveLine(TYPE_DIRECTIVE[block.type]!, block.title), text, ':::'].join('\n')
    case 'video':
      return [directiveLine('video', block.title), block.video_url ?? '', ':::'].join('\n')
    case 'cta':
      return [
        directiveLine('uppmaning', block.title),
        ...(block.links ?? []).map(l => `- ${linkLine(l.label, l.url)}`),
        ':::',
      ].join('\n')
    case 'sources':
      return [
        directiveLine('källor'),
        ...(block.sources ?? []).map(s => `- ${linkLine(s.label, s.url)}`),
        ':::',
      ].join('\n')
    case 'links':
      return [
        directiveLine('länkar', block.title),
        ...(block.links ?? []).map(l => `- ${linkLine(l.label, l.url)}`),
        ':::',
      ].join('\n')
    case 'comparison':
      return [
        directiveLine('jämförelse', block.title),
        ...(block.rows ?? []).map(r => `- ${r.label}: ${r.value}`),
        ':::',
      ].join('\n')
    case 'resource':
      return [
        directiveLine('resurs', block.title),
        text,
        linkLine(block.button_label || 'Öppna', block.url ?? ''),
        ':::',
      ].join('\n')
    default:
      // Blocktyper utan markdown-form (jämförelse, galleri …) sparas som de är
      // så att de överlever ett besök i MD-läget.
      return [directiveLine(JSON_DIRECTIVE), JSON.stringify(block), ':::'].join('\n')
  }
}

export function blocksToMarkdown(blocks: ContentBlock[]): string {
  return blocks.map(blockToMarkdown).join('\n\n').replace(/\n{3,}/g, '\n\n').trim()
}

/** Bygger blocket som ::: -raderna beskrev. */
function directiveToBlock(name: string, title: string, body: string[]): ContentBlock | null {
  if (name === JSON_DIRECTIVE) {
    try {
      const parsed = JSON.parse(body.join('\n')) as ContentBlock
      return parsed && typeof parsed.type === 'string' ? parsed : null
    } catch {
      return null
    }
  }
  const type = DIRECTIVE_TYPE[name.toLowerCase()]
  if (!type) {
    // Okänt namn — hellre ett stycke med texten än att raderna försvinner.
    const text = body.join('\n').trim()
    return text ? { type: 'paragraph', text: plainText(text) } : null
  }
  const links = body
    .map(l => BULLET.exec(l)?.[1] ?? '')
    .map(l => LINK_LINE.exec(l.trim()))
    .filter((m): m is RegExpExecArray => m != null)
    .map(m => ({ label: m[1], url: m[2] }))

  switch (type) {
    case 'factbox':
    case 'warning':
      return { type, title, text: body.join('\n').trim() }
    case 'video':
      return { type, title, video_url: body.map(l => l.trim()).find(Boolean) ?? '' }
    case 'cta':
    case 'links':
      return { type, title, links }
    case 'sources':
      return { type, sources: links }
    case 'comparison':
      return {
        type,
        title,
        rows: body
          .map(l => BULLET.exec(l)?.[1])
          .filter((v): v is string => v != null)
          .map(row => {
            const at = row.indexOf(':')
            return at < 0
              ? { label: plainText(row), value: '' }
              : { label: plainText(row.slice(0, at)), value: plainText(row.slice(at + 1)) }
          }),
      }
    case 'list':
      return { type, title, items: body.map(l => BULLET.exec(l)?.[1]).filter((v): v is string => v != null).map(plainText) }
    case 'resource': {
      const action = body.map(l => LINK_LINE.exec(l.trim())).find(Boolean)
      const text = body.filter(l => !LINK_LINE.test(l.trim())).join('\n').trim()
      return { type, title, text: plainText(text), url: action?.[2] ?? '', button_label: action?.[1] ?? '' }
    }
    default:
      return null
  }
}

export function markdownToBlocks(md: string): ContentBlock[] {
  const lines = md.replace(/\r\n?/g, '\n').split('\n')
  const blocks: ContentBlock[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) { i++; continue }

    const directive = DIRECTIVE_OPEN.exec(line)
    if (directive && !DIRECTIVE_CLOSE.test(line)) {
      const body: string[] = []
      i++
      while (i < lines.length && !DIRECTIVE_CLOSE.test(lines[i])) body.push(lines[i++])
      i++ // hoppa över den avslutande :::-raden (saknas den tar texten slut här)
      const block = directiveToBlock(directive[1], directive[2].trim(), body)
      if (block) blocks.push(block)
      continue
    }

    if (RULE.test(line)) { blocks.push({ type: 'divider' }); i++; continue }

    const heading = HEADING.exec(line)
    if (heading) {
      blocks.push({ type: 'heading', text: plainText(heading[2]), level: heading[1].length })
      i++
      continue
    }

    if (QUOTE.test(line)) {
      const quoted: string[] = []
      while (i < lines.length && QUOTE.test(lines[i])) quoted.push(QUOTE.exec(lines[i++])![1])
      blocks.push({ type: 'quote', text: plainText(quoted.join('\n')) })
      continue
    }

    const image = IMAGE_LINE.exec(line.trim())
    if (image) {
      blocks.push({ type: 'image', image_url: image[2], alt_text: image[1], text: image[3] ?? '' })
      i++
      continue
    }

    // En ensam länk på egen rad är en knapp — inne i ett stycke blir den text.
    const link = LINK_LINE.exec(line.trim())
    if (link) { blocks.push({ type: 'button', text: link[1], url: link[2] }); i++; continue }

    if (BULLET.test(line)) {
      const items: string[] = []
      while (i < lines.length && BULLET.test(lines[i]) && !RULE.test(lines[i])) {
        items.push(plainText(BULLET.exec(lines[i++])![1]))
      }
      blocks.push({ type: 'list', items })
      continue
    }

    // Allt annat är brödtext fram till nästa tomma rad eller nästa blockstart.
    const paragraph: string[] = []
    while (i < lines.length && lines[i].trim() && !startsBlock(lines[i]) && !SETEXT.test(lines[i])) {
      paragraph.push(lines[i++])
    }
    // En understruken rad är också en rubrik: === ger nivå 1, --- nivå 2.
    const underline = SETEXT.exec(lines[i] ?? '')
    if (underline && paragraph.length) {
      i++
      blocks.push({ type: 'heading', text: plainText(paragraph.join('\n')), level: underline[1][0] === '=' ? 1 : 2 })
      continue
    }
    blocks.push({ type: 'paragraph', text: plainText(paragraph.join('\n')) })
  }

  return blocks
}

/** true om raden inleder något annat än brödtext, så stycket ska brytas här. */
function startsBlock(line: string): boolean {
  return DIRECTIVE_OPEN.test(line) || RULE.test(line) || HEADING.test(line)
    || QUOTE.test(line) || BULLET.test(line)
    || IMAGE_LINE.test(line.trim()) || LINK_LINE.test(line.trim())
}
