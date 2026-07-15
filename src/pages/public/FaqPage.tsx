import { useEffect, useState } from 'react'
import PageHeader from '../../components/public/PageHeader'
import type { FaqCategory, FaqItem } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { usePage } from '../../lib/usePage'

export default function FaqPage() {
  const page = usePage('fragor-och-svar')
  const [categories, setCategories] = useState<FaqCategory[]>([])
  const [items, setItems] = useState<FaqItem[]>([])
  const [loading, setLoading] = useState(true)
  const [openItems, setOpenItems] = useState<Set<string>>(new Set())

  useEffect(() => {
    Promise.all([
      supabase.from('faq_categories').select('*').order('sort_order'),
      supabase.from('faq_items').select('*').eq('status', 'published').order('sort_order'),
    ]).then(([c, i]) => {
      setCategories(c.data as FaqCategory[] ?? [])
      setItems(i.data as FaqItem[] ?? [])
      setLoading(false)
    })
  }, [])

  function toggle(id: string) {
    setOpenItems(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (loading) return <div className="loading"><div className="spinner"></div></div>

  return (
    <div className="container container-narrow fade-in">
      <div className="page-header">
        <PageHeader slug="fragor-och-svar" />
      </div>

      {categories.length === 0 && items.length === 0 ? (
        <div className="empty-state">
          <p>Inga frågor har publicerats ännu.</p>
        </div>
      ) : (
        <div style={{ marginBottom: 'var(--space-9)' }}>
          {categories.map(cat => {
            const catItems = items.filter(i => i.category_id === cat.id)
            if (catItems.length === 0) return null
            return (
              <div key={cat.id} className="faq-category">
                <h3>{cat.name}</h3>
                {catItems.map(item => (
                  <div key={item.id} className="faq-item">
                    <button
                      className="faq-question"
                      onClick={() => toggle(item.id)}
                      aria-expanded={openItems.has(item.id)}
                    >
                      <span>{item.question}</span>
                      <span aria-hidden="true">{openItems.has(item.id) ? '−' : '+'}</span>
                    </button>
                    {openItems.has(item.id) && (
                      <div className="faq-answer">{item.answer}</div>
                    )}
                  </div>
                ))}
              </div>
            )
          })}
          {/* Uncategorized items */}
          {items.filter(i => !i.category_id).length > 0 && (
            <div className="faq-category">
              <h3>{page.text('uncategorized_heading')}</h3>
              {items.filter(i => !i.category_id).map(item => (
                <div key={item.id} className="faq-item">
                  <button
                    className="faq-question"
                    onClick={() => toggle(item.id)}
                    aria-expanded={openItems.has(item.id)}
                  >
                    <span>{item.question}</span>
                    <span aria-hidden="true">{openItems.has(item.id) ? '−' : '+'}</span>
                  </button>
                  {openItems.has(item.id) && <div className="faq-answer">{item.answer}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
