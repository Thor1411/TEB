import { useEffect, useRef, useState } from 'react'
import PDFEditor from './components/PDFEditor'
import './App.css'

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('token') || '')
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('admin123')
  const [error, setError] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  const lastValidatedTokenRef = useRef('')

  useEffect(() => {
    if (token) localStorage.setItem('token', token)
    else localStorage.removeItem('token')
  }, [token])

  useEffect(() => {
    let cancelled = false
    const validate = async () => {
      if (!token) return
      if (lastValidatedTokenRef.current === token) return
      lastValidatedTokenRef.current = token
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (!res.ok) {
          if (!cancelled) setToken('')
        }
      } catch {
        // If backend is down, keep token; user can retry later.
      }
    }

    validate()
    return () => { cancelled = true }
  }, [token])

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoggingIn(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || 'Login failed')
        return
      }

      setToken(data.token)
    } catch (err) {
      setError(err?.message || 'Login failed')
    } finally {
      setLoggingIn(false)
    }
  }

  const handleLogout = () => {
    setToken('')
  }

  return (
    <div className="App">
      {!token ? (
        <div style={{ maxWidth: 420, margin: '40px auto', textAlign: 'left' }}>
          <h2 style={{ marginBottom: 8 }}>Secure PDF Platform Login</h2>
          <p style={{ marginTop: 0, opacity: 0.8 }}>Default: admin / admin123</p>
          <form onSubmit={handleLogin}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label>
                Username
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  style={{ width: '100%', padding: 10, marginTop: 6 }}
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ width: '100%', padding: 10, marginTop: 6 }}
                />
              </label>
              {error ? <div style={{ color: '#b00020' }}>{error}</div> : null}
              <button
                type="submit"
                disabled={loggingIn}
                style={{ padding: 12, cursor: loggingIn ? 'not-allowed' : 'pointer' }}
              >
                {loggingIn ? 'Logging in…' : 'Login'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <PDFEditor token={token} onLogout={handleLogout} />
      )}
    </div>
  )
}

export default App
