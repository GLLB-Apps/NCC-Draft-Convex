import { useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { ContentBlock } from '../../lib/types'

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
  { type: 'sources', label: 'Källor' },
  { type: 'divider', label: 'Avdelare' },
]

function blankBlock(type: ContentBlock['type']): ContentBlock {
  const b: ContentBlock = { type }
  if (type === 'paragraph' || type === 'heading' || type === 'quote') b.text = ''
  if (type === 'factbox' || type === 'warning') { b.title = ''; b.text = '' }
  if (type === 'image') { b.image_url = ''; b.alt_text = ''; b.text = '' }
  if (type === 'video') { b.video_url = ''; b.title = '' }
  if (type === 'button') { b.text = ''; b.url = '' }
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
    <div className="tap-editor">
      <div className="tap-toolbar">
        <div className="tap-toolbar-group">
          <button type="button" className={focusedType === 'paragraph' ? 'tap-tool active' : 'tap-tool'} disabled={!focusedIsText} onMouseDown={e => e.preventDefault()} onClick={() => focused != null && setType(focused, 'paragraph')}>Text</button>
          <button type="button" className={focusedType === 'heading' ? 'tap-tool active' : 'tap-tool'} disabled={!focusedIsText} onMouseDown={e => e.preventDefault()} onClick={() => focused != null && setType(focused, 'heading')}>Rubrik</button>
          <button type="button" className={focusedType === 'quote' ? 'tap-tool active' : 'tap-tool'} disabled={!focusedIsText} onMouseDown={e => e.preventDefault()} onClick={() => focused != null && setType(focused, 'quote')}>Citat</button>
        </div>
        <span className="tap-toolbar-sep" />
        <div className="tap-toolbar-group">
          {INSERTS.map(ins => (
            <button key={ins.type} type="button" className="tap-tool tap-tool-insert" onMouseDown={e => e.preventDefault()} onClick={() => insertAfter(focused, ins.type)}>
              + {ins.label}
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

      <p className="tap-hint">Klicka och skriv. Tryck <kbd>Enter</kbd> för ny rad. Markera en rad och tryck <strong>Rubrik</strong> eller <strong>Citat</strong> för att ändra stil.</p>
    </div>
  )
}
