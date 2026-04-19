import { useEffect, useMemo, useState } from 'react'

const formatGitHistory = (git) => {
  if (!git?.head || !git?.commits) return 'No history'
  const lines = []
  const headShort = String(git.head).slice(0, 8)
  lines.push(`Repo: ${git.repoId || 'unknown'}`)
  lines.push(`HEAD -> main (${headShort})`)
  lines.push('')

  const seen = new Set()
  let cur = git.head
  let n = 0
  while (cur && git.commits[cur] && !seen.has(cur) && n < 50) {
    seen.add(cur)
    const c = git.commits[cur]
    const actor = c.actor?.email || c.actor?.id || 'unknown'
    const short = String(c.id || cur).slice(0, 8)
    lines.push(`o ${short}  ${c.message}`)
    lines.push(`|  ${c.ts}  by ${actor}`)
    if (Array.isArray(c.actions) && c.actions.length > 0) {
      for (const a of c.actions.slice(0, 12)) {
        const page = a.page ? ` page=${a.page}` : ''
        const txt = a.text ? ` text=${JSON.stringify(String(a.text).slice(0, 120))}` : ''
        lines.push(`|  - ${a.type}${page}${txt}`)
      }
      if (c.actions.length > 12) lines.push('|  - ...')
    }
    lines.push('|')
    cur = c.parent
    n++
  }
  return lines.join('\n')
}

function PDFGitTreePage() {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const docId = params.get('docId') || ''
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [text, setText] = useState('Loading…')
  const [signatureLine, setSignatureLine] = useState('')

  const token = useMemo(() => localStorage.getItem('token') || '', [])

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      setLoading(true)
      setError('')
      setSignatureLine('')

      if (!docId) {
        setText('Missing docId in URL')
        setLoading(false)
        return
      }

      if (!token) {
        setText('Not logged in. Open the main app tab and login first.')
        setLoading(false)
        return
      }

      try {
        const res = await fetch(`${API_URL}/api/documents/${docId}/git`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error || 'Failed to load PDF Git')
        if (!data?.enabled) {
          setText('PDF Git is not initialized for this PDF.')
          setLoading(false)
          return
        }

        const sig = data.signature
        const sigLine = typeof sig?.ok === 'boolean'
          ? `Signature: ${sig.ok ? 'OK' : 'FAIL'}${sig.error ? ` (${sig.error})` : ''}`
          : 'Signature: unknown'

        if (!cancelled) {
          setSignatureLine(sigLine)
          setText(formatGitHistory(data.git))
          setLoading(false)
        }
      } catch (e) {
        if (cancelled) return
        setError(e?.message || 'Failed to load')
        setText(e?.message || 'Failed to load')
        setLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [docId, token])

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif' }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(127,127,127,0.25)' }}>
        <div style={{ fontWeight: 700 }}>PDF Git — History tree</div>
        <div style={{ opacity: 0.8, fontSize: 13, marginTop: 4 }}>
          Document: {docId || '—'}{signatureLine ? ` • ${signatureLine}` : ''}
        </div>
        <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
          <button
            onClick={() => window.location.reload()}
            disabled={loading}
            style={{ padding: '8px 10px', cursor: loading ? 'not-allowed' : 'pointer' }}
          >Refresh
          </button>
          <a href="/" style={{ padding: '8px 10px' }}>Back to editor</a>
        </div>
      </div>

      <div style={{ padding: '14px 16px' }}>
        {error ? (
          <div style={{ color: '#b00020', marginBottom: 12 }}>{error}</div>
        ) : null}
        <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.35, fontSize: 13, margin: 0 }}>
          {text}
        </pre>
      </div>
    </div>
  )
}

export default PDFGitTreePage
