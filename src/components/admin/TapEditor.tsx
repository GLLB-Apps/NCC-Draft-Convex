import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { ContentBlock, DocumentItem } from '../../lib/types'
import { supabase } from '../../lib/supabase'

// A document-style editor for non-technical admins: click anywhere and type,
// press Enter for a new line, and tap the toolbar to turn a line into a heading
// or quote — no manual "block building". Richer elements (image, factbox, …)
// are inserted from the same toolbar and edited inline. Stores the same
// ContentBlock[] shape the public site already renders.

const TEXT_TYPES = ['heading', 'paragraph', 'quote'] as const
type TextType = typeof TEXT_TYPES[number]
const isText = (t: string): t is TextType => (TEXT_TYPES as readonly string[]).includes(t)

const INSERTS: { type: ContentBlock['type']; label: string }[] = [
  { type: 'image', label: 'Bild' },
  { type: 'factbox', label: 'Faktaruta' },
  { type: 'warning', label: 'Varningsruta' },
  { type: 'list', label: 'Punktlista' },
  { type: 'cta', label: 'Uppmaning' },
  { type: 'video', label: 'Video' },
  { type: 'button', label: 'Knapp' },
  { type: 'resource', label: 'Extern resurs' },
  { type: 'sources', label: 'Källor' },
  { type: 'divider', label: 'Avdelare' },
]

/** Publicerade dokument att länka till, hämtas en gång per editor. */
function usePublishedDocuments() {
  const [docs, setDocs] = useState<DocumentItem[]>([])
  useEffect(() => {
    let active = true
    supabase.from('documents').select('*').eq('status', 'published').order('published_at', { ascending: false })
      .then(({ data }) => { if (active) setDocs((data as DocumentItem[] ?? []).filter(d => d.file_url || d.external_url)) })
    return () => { active = false }
  }, [])
  return docs
}

const documentUrl = (doc: DocumentItem) => doc.file_url || doc.external_url || ''

/**
 * Väljare som fyller i länken till ett uppladdat dokument, så att en knapp kan
 * peka på t.ex. ett yttrande utan att adressen behöver klistras in för hand.
 */
function DocumentPicker({ docs, url, onPick }: {
  docs: DocumentItem[]
  url: string
  onPick: (doc: DocumentItem) => void
}) {
  if (docs.length === 0) {
    return (
      <p className="form-hint">
        Inga publicerade dokument att länka till ännu — ladda upp under Dokument först.
      </p>
    )
  }
  return (
    <>
      <select
        className="form-select"
        value={docs.some(d => documentUrl(d) === url) ? url : ''}
        onChange={e => {
          const doc = docs.find(d => documentUrl(d) === e.target.value)
          if (doc) onPick(doc)
        }}
        aria-label="Välj dokument"
      >
        <option value="">Välj ett dokument…</option>
        {docs.map(d => (
          <option key={d.id} value={documentUrl(d)}>
            {d.title}{d.file_type ? ` (${d.file_type})` : ''}
          </option>
        ))}
      </select>
      <p className="form-hint">…eller klistra in en egen länk i fältet ovan.</p>
    </>
  )
}

// Alt+<letter> quick-inserts a block (or, for text styles, applies the style),
// so you rarely need to reach for the toolbar. Letters follow the Swedish label
// where it doesn't clash (Faktaruta→F, Varningsruta→V, Uppmaning→U …); Video
// falls back to the "I" in vIdeo since V is taken. The letter is shown on each
// toolbar button so it stays discoverable.
const SHORTCUT_KEY: Partial<Record<ContentBlock['type'], string>> = {
  paragraph: 'T', heading: 'R', quote: 'C',
  image: 'B', factbox: 'F', warning: 'V', list: 'L',
  cta: 'U', video: 'I', button: 'K', resource: 'X', sources: 'S', divider: 'A',
}
// e.code (layout-independent, avoids AltGr special chars) → block type.
const CODE_TO_TYPE = Object.fromEntries(
  Object.entries(SHORTCUT_KEY).map(([type, key]) => ['Key' + key, type as ContentBlock['type']]),
) as Record<string, ContentBlock['type'] | undefined>

function blankBlock(type: ContentBlock['type']): ContentBlock {
  const b: ContentBlock = { type }
  if (type === 'paragraph' || type === 'heading' || type === 'quote') b.text = ''
  if (type === 'factbox' || type === 'warning') { b.title = ''; b.text = '' }
  if (type === 'image') { b.image_url = ''; b.alt_text = ''; b.text = '' }
  if (type === 'video') { b.video_url = ''; b.title = '' }
  if (type === 'button') { b.text = ''; b.url = '' }
  if (type === 'resource') { b.title = ''; b.text = ''; b.url = ''; b.button_label = '' }
  if (type === 'sources') { b.sources = [] }
  if (type === 'list') { b.title = ''; b.items = [''] }
  if (type === 'cta') { b.title = ''; b.links = [] }
  return b
}

function autosize(el: HTMLTextAreaElement | null) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = el.scrollHeight + 'px'
}

interface Props {
  blocks: ContentBlock[]
  onChange: (blocks: ContentBlock[]) => void
}

export default function TapEditor({ blocks, onChange }: Props) {
  const refs = useRef<(HTMLTextAreaElement | null)[]>([])
  const [focused, setFocused] = useState<number | null>(null)
  const [pending, setPending] = useState<{ index: number; caret: number } | null>(null)
  const documents = usePublishedDocuments()

  // Ensure there is always something to type into.
  const list = blocks.length ? blocks : [{ type: 'paragraph' as const, text: '' }]

  useLayoutEffect(() => {
    refs.current.forEach(autosize)
  })

  useLayoutEffect(() => {
    if (!pending) return
    const el = refs.current[pending.index]
    if (el) {
      el.focus()
      const c = Math.min(pending.caret, el.value.length)
      el.setSelectionRange(c, c)
      autosize(el)
    }
    setPending(null)
  }, [pending])

  function commit(next: ContentBlock[]) {
    onChange(next.length ? next : [{ type: 'paragraph', text: '' }])
  }
  function set(index: number, updates: Partial<ContentBlock>) {
    commit(list.map((b, i) => (i === index ? { ...b, ...updates } : b)))
  }
  function setType(index: number, type: ContentBlock['type']) {
    commit(list.map((b, i) => (i === index ? { ...b, type } : b)))
    setPending({ index, caret: (list[index].text ?? '').length })
  }
  function removeAt(index: number) {
    commit(list.filter((_, i) => i !== index))
    setPending({ index: Math.max(0, index - 1), caret: 99999 })
  }
  function moveAt(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= list.length) return
    const next = [...list]
    ;[next[index], next[target]] = [next[target], next[index]]
    commit(next)
  }
  function insertAfter(index: number | null, type: ContentBlock['type']) {
    const at = index == null ? list.length : index + 1
    commit([...list.slice(0, at), blankBlock(type), ...list.slice(at)])
    if (isText(type)) setPending({ index: at, caret: 0 })
  }
  // The text-style buttons double as a way to "break free" from an element
  // block: with a text line focused they convert it, but with an element
  // (bild, faktaruta, …) focused — or nothing focused — they add a fresh text
  // line after it so you can keep writing freely.
  function applyText(type: TextType) {
    if (focused != null && isText(list[focused].type)) setType(focused, type)
    else insertAfter(focused, type)
  }

  // Ctrl+Alt+<letter> anywhere in the editor quick-inserts the matching block
  // after the focused one (or applies the style, for text). Uses e.code so it's
  // layout-independent. Note: on Nordic keyboards AltGr sends Ctrl+Alt, but the
  // chosen letters don't produce AltGr characters on those layouts, so typing is
  // unaffected.
  function onEditorKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!e.altKey || !e.ctrlKey || e.metaKey) return
    const type = CODE_TO_TYPE[e.code]
    if (!type) return
    e.preventDefault()
    if (isText(type)) applyText(type)
    else insertAfter(focused, type)
  }

  function onTextKeyDown(e: KeyboardEvent<HTMLTextAreaElement>, index: number) {
    const el = e.currentTarget
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const caret = el.selectionStart
      const before = el.value.slice(0, caret)
      const after = el.value.slice(caret)
      const next = [...list]
      next[index] = { ...list[index], text: before }
      next.splice(index + 1, 0, { type: 'paragraph', text: after })
      commit(next)
      setPending({ index: index + 1, caret: 0 })
    } else if (e.key === 'Backspace' && el.selectionStart === 0 && el.selectionEnd === 0) {
      if (index === 0) return
      const prev = list[index - 1]
      if (!isText(prev.type)) return
      e.preventDefault()
      const prevText = prev.text ?? ''
      const next = [...list]
      next[index - 1] = { ...prev, text: prevText + (list[index].text ?? '') }
      next.splice(index, 1)
      commit(next)
      setPending({ index: index - 1, caret: prevText.length })
    }
  }

  const focusedIsText = focused != null && list[focused] && isText(list[focused].type)
  const focusedType = focusedIsText ? list[focused!].type : null

  const placeholder = (type: string, index: number) =>
    type === 'heading' ? 'Rubrik'
      : type === 'quote' ? 'Citat…'
        : index === 0 ? 'Börja skriva…' : 'Skriv här…'

  return (
    <div className="tap-editor" onKeyDown={onEditorKeyDown}>
      <div className="tap-toolbar">
        <div className="tap-toolbar-group">
          <button type="button" title="Text (Ctrl+Alt+T)" className={focusedType === 'paragraph' ? 'tap-tool active' : 'tap-tool'} onMouseDown={e => e.preventDefault()} onClick={() => applyText('paragraph')}>Text</button>
          <button type="button" title="Rubrik (Ctrl+Alt+R)" className={focusedType === 'heading' ? 'tap-tool active' : 'tap-tool'} onMouseDown={e => e.preventDefault()} onClick={() => applyText('heading')}>Rubrik</button>
          <button type="button" title="Citat (Ctrl+Alt+C)" className={focusedType === 'quote' ? 'tap-tool active' : 'tap-tool'} onMouseDown={e => e.preventDefault()} onClick={() => applyText('quote')}>Citat</button>
        </div>
        <span className="tap-toolbar-sep" />
        <div className="tap-toolbar-group">
          {INSERTS.map(ins => (
            <button key={ins.type} type="button" title={`${ins.label} (Ctrl+Alt+${SHORTCUT_KEY[ins.type]})`} className="tap-tool tap-tool-insert" onMouseDown={e => e.preventDefault()} onClick={() => insertAfter(focused, ins.type)}>
              + {ins.label} <span className="tap-tool-key">{SHORTCUT_KEY[ins.type]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="tap-doc">
        {list.map((block, i) => (
          <div className="tap-block" key={i}>
            <div className="tap-block-ctrls">
              <button type="button" onClick={() => moveAt(i, -1)} disabled={i === 0} aria-label="Flytta upp">↑</button>
              <button type="button" onClick={() => moveAt(i, 1)} disabled={i === list.length - 1} aria-label="Flytta ner">↓</button>
              <button type="button" className="danger" onClick={() => removeAt(i)} aria-label="Ta bort">✕</button>
            </div>

            {isText(block.type) ? (
              <textarea
                ref={el => { refs.current[i] = el }}
                className={`tap-text tap-${block.type}`}
                value={block.text ?? ''}
                rows={1}
                placeholder={placeholder(block.type, i)}
                onFocus={() => setFocused(i)}
                onChange={e => { set(i, { text: e.target.value }); autosize(e.target) }}
                onKeyDown={e => onTextKeyDown(e, i)}
              />
            ) : (
              <div className="tap-element" onFocus={() => setFocused(i)}>
                <span className="tap-element-tag">{INSERTS.find(x => x.type === block.type)?.label ?? block.type}</span>

                {block.type === 'divider' && <hr className="tap-divider" />}

                {(block.type === 'factbox' || block.type === 'warning') && (
                  <>
                    <input className="form-input" type="text" value={block.title ?? ''} onChange={e => set(i, { title: e.target.value })} placeholder="Rubrik" />
                    <textarea className="form-textarea" rows={3} value={block.text ?? ''} onChange={e => set(i, { text: e.target.value })} placeholder="Text" />
                  </>
                )}

                {block.type === 'image' && (
                  <>
                    <input className="form-input" type="url" value={block.image_url ?? ''} onChange={e => set(i, { image_url: e.target.value })} placeholder="Klistra in bildadress (URL)" />
                    <input className="form-input" type="text" value={block.alt_text ?? ''} onChange={e => set(i, { alt_text: e.target.value })} placeholder="Beskriv bilden (alt-text)" />
                    <input className="form-input" type="text" value={block.text ?? ''} onChange={e => set(i, { text: e.target.value })} placeholder="Bildtext (valfritt)" />
                    {block.image_url && <img src={block.image_url} alt="" className="tap-image-preview" />}
                  </>
                )}

                {block.type === 'video' && (
                  <>
                    <input className="form-input" type="url" value={block.video_url ?? ''} onChange={e => set(i, { video_url: e.target.value })} placeholder="Video-länk (YouTube/Vimeo embed)" />
                    <input className="form-input" type="text" value={block.title ?? ''} onChange={e => set(i, { title: e.target.value })} placeholder="Titel (valfritt)" />
                  </>
                )}

                {block.type === 'button' && (
                  <>
                    <input className="form-input" type="text" value={block.text ?? ''} onChange={e => set(i, { text: e.target.value })} placeholder="Knapptext" />
                    <input className="form-input" type="url" value={block.url ?? ''} onChange={e => set(i, { url: e.target.value })} placeholder="Länk (URL)" />
                    <DocumentPicker
                      docs={documents}
                      url={block.url ?? ''}
                      onPick={doc => set(i, { url: documentUrl(doc), text: block.text || doc.title })}
                    />
                  </>
                )}

                {block.type === 'resource' && (
                  <>
                    <input className="form-input" type="text" value={block.title ?? ''} onChange={e => set(i, { title: e.target.value })} placeholder="Rubrik – t.ex. Enkät om Rögleskogen" />
                    <textarea className="form-textarea" rows={2} value={block.text ?? ''} onChange={e => set(i, { text: e.target.value })} placeholder="Kort beskrivning (valfritt)" />
                    <input className="form-input" type="url" value={block.url ?? ''} onChange={e => set(i, { url: e.target.value })} placeholder="Länk (URL) – öppnas i nytt fönster" />
                    <input className="form-input" type="text" value={block.button_label ?? ''} onChange={e => set(i, { button_label: e.target.value })} placeholder="Knapptext (valfritt, standard: ”Öppna”)" />
                    <DocumentPicker
                      docs={documents}
                      url={block.url ?? ''}
                      onPick={doc => set(i, {
                        url: documentUrl(doc),
                        title: block.title || doc.title,
                        text: block.text || doc.description || '',
                      })}
                    />
                  </>
                )}

                {block.type === 'list' && (
                  <div className="tap-sources">
                    <input className="form-input" type="text" value={block.title ?? ''} onChange={e => set(i, { title: e.target.value })} placeholder="Rubrik (valfritt)" />
                    {(block.items ?? []).map((it, li) => (
                      <div key={li} className="tap-source-row">
                        <input className="form-input" type="text" value={it} onChange={e => {
                          const items = [...(block.items ?? [])]; items[li] = e.target.value; set(i, { items })
                        }} placeholder="Punkt" />
                        <button type="button" className="tap-source-remove" onClick={() => set(i, { items: (block.items ?? []).filter((_, j) => j !== li) })} aria-label="Ta bort punkt">✕</button>
                      </div>
                    ))}
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => set(i, { items: [...(block.items ?? []), ''] })}>+ Lägg till punkt</button>
                  </div>
                )}

                {block.type === 'cta' && (
                  <div className="tap-sources">
                    <input className="form-input" type="text" value={block.title ?? ''} onChange={e => set(i, { title: e.target.value })} placeholder="Rubrik (valfritt)" />
                    {(block.links ?? []).map((lnk, li) => (
                      <div key={li} className="tap-source-row">
                        <input className="form-input" type="text" value={lnk.label} onChange={e => {
                          const links = [...(block.links ?? [])]; links[li] = { ...links[li], label: e.target.value }; set(i, { links })
                        }} placeholder="Knapptext" />
                        <input className="form-input" type="text" value={lnk.url} onChange={e => {
                          const links = [...(block.links ?? [])]; links[li] = { ...links[li], url: e.target.value }; set(i, { links })
                        }} placeholder="Länk (URL eller /sida)" />
                        <button type="button" className="tap-source-remove" onClick={() => set(i, { links: (block.links ?? []).filter((_, j) => j !== li) })} aria-label="Ta bort knapp">✕</button>
                      </div>
                    ))}
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => set(i, { links: [...(block.links ?? []), { label: '', url: '' }] })}>+ Lägg till knapp</button>
                  </div>
                )}

                {block.type === 'sources' && (
                  <div className="tap-sources">
                    {(block.sources ?? []).map((src, si) => (
                      <div key={si} className="tap-source-row">
                        <input className="form-input" type="text" value={src.label} onChange={e => {
                          const sources = [...(block.sources ?? [])]; sources[si] = { ...sources[si], label: e.target.value }; set(i, { sources })
                        }} placeholder="Källnamn" />
                        <input className="form-input" type="url" value={src.url} onChange={e => {
                          const sources = [...(block.sources ?? [])]; sources[si] = { ...sources[si], url: e.target.value }; set(i, { sources })
                        }} placeholder="URL" />
                        <button type="button" className="tap-source-remove" onClick={() => set(i, { sources: (block.sources ?? []).filter((_, j) => j !== si) })} aria-label="Ta bort källa">✕</button>
                      </div>
                    ))}
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => set(i, { sources: [...(block.sources ?? []), { label: '', url: '' }] })}>+ Lägg till källa</button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="tap-hint">Klicka och skriv. Tryck <kbd>Enter</kbd> för ny rad. Markera en rad och tryck <strong>Rubrik</strong> eller <strong>Citat</strong> för att ändra stil. Står du i en ruta (bild, faktaruta …) kan du trycka <strong>Text</strong>, <strong>Rubrik</strong> eller <strong>Citat</strong> för att fortsätta skriva under den. Håll <kbd>Ctrl</kbd>+<kbd>Alt</kbd> och tryck bokstaven på en knapp för att lägga till blocket direkt.</p>
    </div>
  )
}
