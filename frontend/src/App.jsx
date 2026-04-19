import { useEffect, useRef, useState } from 'react'
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google'
import PDFEditor from './components/PDFEditor'
import PDFGitTreePage from './components/PDFGitTreePage'
import './App.css'

function App() {
  const params = new URLSearchParams(window.location.search)
  const isGitTree = params.get('gitTree') === '1'
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

  const [token, setToken] = useState(() => {
    const saved = localStorage.getItem('token')
    return saved && saved !== 'undefined' && saved !== 'null' ? saved : ''
  })
  
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('token')
    if (saved && saved !== 'undefined' && saved !== 'null') {
      try {
        const payload = JSON.parse(atob(saved.split('.')[1]))
        return { id: payload.sub, name: payload.name, email: payload.email, roles: payload.roles }
      } catch (e) {
        return null
      }
    }
    return null
  })
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignMeUp, setIsSignMeUp] = useState(false)
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
        const res = await fetch(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (!res.ok) {
          if (!cancelled) setToken('')
        } else {
          const data = await res.json()
          if (!cancelled) setCurrentUser(data.user)
        }
      } catch {
        // If backend is down, keep token; user can retry later.
      }
    }

    validate()
    return () => { cancelled = true }
  }, [token])

  const handleAuth = async (e) => {
    e.preventDefault()
    setError('')
    setLoggingIn(true)

    try {
      const endpoint = isSignMeUp ? `${API_URL}/api/auth/signup` : `${API_URL}/api/auth/login`
      const body = isSignMeUp ? { name, email, password } : { email, password }
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || (isSignMeUp ? 'Signup failed' : 'Login failed'))
        return
      }

      setToken(data.token || '')
      setCurrentUser(data.user || null)
    } catch (err) {
      setError(err?.message || (isSignMeUp ? 'Signup failed' : 'Login failed'))
    } finally {
      setLoggingIn(false)
    }
  }

  const handleLogout = () => {
    setToken('')
    setCurrentUser(null)
  }

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      setError('')
      setLoggingIn(true)
      const res = await fetch(`${API_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: credentialResponse.credential })
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || 'Google auth failed')
        return
      }

      setToken(data.token || '')
      setCurrentUser(data.user || null)
    } catch (err) {
      setError(err?.message || 'Google auth failed')
    } finally {
      setLoggingIn(false)
    }
  }

  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || "744678399714-80lch3d91d2bphm2mu0194sunt6sh5ui.apps.googleusercontent.com"}>
      <div className="App">
        {isGitTree ? (
          <PDFGitTreePage />
        ) : !token ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F9F3EF', minHeight: '100vh' }}>
          <header className="app-header" style={{ position: 'relative' }}>
            <h1 className="header-title" style={{ margin: 0 }}>
              <img 
                src="/images/iitr_logo.png" 
                alt="Logo" 
                className="header-logo"
              />
              PDF Editor
            </h1>
            <p style={{ margin: '0.5rem 0 0 0' }}>Upload, edit, and download your PDF files</p>
          </header>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
            <div style={{ 
              background: '#ffffff', 
              padding: '3rem', 
              borderRadius: '8px', 
              boxShadow: '0 8px 24px rgba(27, 60, 83, 0.1)', 
              width: '100%', 
              maxWidth: '400px',
              border: '2px solid #8C9491'
            }}>
              <h2 style={{ 
                fontFamily: '"Oswald", sans-serif', 
                color: '#1B3C53', 
                marginTop: 0, 
                fontSize: '2.2rem', 
                textAlign: 'center', 
                marginBottom: '0.5rem' 
              }}>
                {isSignMeUp ? 'Create Account' : 'Welcome Back'}
              </h2>
              <p style={{ 
                marginTop: 0, 
                color: '#456882', 
                textAlign: 'center', 
                fontFamily: '"Montserrat", sans-serif', 
                fontSize: '0.9rem', 
                marginBottom: '1rem' 
              }}>
                {isSignMeUp ? 'Sign up to get started with secure PDF editing' : 'Login to your account'}
              </p>

              <form onSubmit={handleAuth}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {isSignMeUp && (
                    <label style={{ fontFamily: '"Montserrat", sans-serif', color: '#1B3C53', fontWeight: 600, fontSize: '0.9rem' }}>
                      Full Name
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        style={{ 
                          width: '100%', 
                          padding: '10px', 
                          marginTop: '4px',
                          border: '2px solid #8C9491',
                          borderRadius: '4px',
                          fontFamily: '"Montserrat", sans-serif',
                          boxSizing: 'border-box'
                        }}
                        required={isSignMeUp}
                      />
                    </label>
                  )}
                  
                  <label style={{ fontFamily: '"Montserrat", sans-serif', color: '#1B3C53', fontWeight: 600, fontSize: '0.9rem' }}>
                    Email Address
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      style={{ 
                        width: '100%', 
                        padding: '10px', 
                        marginTop: '4px',
                        border: '2px solid #8C9491',
                        borderRadius: '4px',
                        fontFamily: '"Montserrat", sans-serif',
                        boxSizing: 'border-box'
                      }}
                      required
                    />
                  </label>

                  <label style={{ fontFamily: '"Montserrat", sans-serif', color: '#1B3C53', fontWeight: 600, fontSize: '0.9rem' }}>
                    Password
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      style={{ 
                        width: '100%', 
                        padding: '10px', 
                        marginTop: '4px',
                        border: '2px solid #8C9491',
                        borderRadius: '4px',
                        fontFamily: '"Montserrat", sans-serif',
                        boxSizing: 'border-box'
                      }}
                      required
                    />
                  </label>

                  {error ? (
                    <div style={{ 
                      color: '#dc3545', 
                      background: '#f8d7da', 
                      padding: '8px', 
                      borderRadius: '4px', 
                      fontSize: '0.9rem',
                      fontFamily: '"Montserrat", sans-serif',
                      border: '1px solid #f5c6cb' 
                    }}>
                      {error}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={loggingIn || !email || !password || (isSignMeUp && !name)}
                    style={{ 
                      marginTop: '0.25rem',
                      padding: '12px', 
                      cursor: loggingIn ? 'not-allowed' : 'pointer',
                      background: '#1B3C53',
                      color: '#D2C1B6',
                      border: 'none',
                      borderRadius: '4px',
                      fontFamily: '"Montserrat", sans-serif',
                      fontWeight: 600,
                      fontSize: '1rem',
                      transition: 'all 0.2s',
                      opacity: (loggingIn || !email || !password || (isSignMeUp && !name)) ? 0.7 : 1
                    }}
                    onMouseOver={(e) => { if (!e.target.disabled) e.target.style.background = '#456882' }}
                    onMouseOut={(e) => { if (!e.target.disabled) e.target.style.background = '#1B3C53' }}
                  >
                    {loggingIn ? 'Processing…' : (isSignMeUp ? 'Sign Up' : 'Login')}
                  </button>
                  
                  <div style={{ display: 'flex', alignItems: 'center', margin: '0.5rem 0' }}>
                    <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(140, 148, 145, 0.4)' }}></div>
                    <div style={{ padding: '0 15px', color: '#8C9491', fontSize: '0.85rem', fontFamily: '"Montserrat", sans-serif', fontWeight: 600 }}>OR</div>
                    <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(140, 148, 145, 0.4)' }}></div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0' }}>
                    <GoogleLogin
                      onSuccess={handleGoogleSuccess}
                      onError={() => setError('Google Login Failed')}
                      theme="filled_blue"
                      shape="rectangular"
                      text={isSignMeUp ? "signup_with" : "signin_with"}
                      size="large"
                    />
                  </div>
                  
                  <div style={{ textAlign: 'center', marginTop: '0.25rem' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setIsSignMeUp(!isSignMeUp)
                        setError('')
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#456882',
                        cursor: 'pointer',
                        fontFamily: '"Montserrat", sans-serif',
                        fontSize: '0.9rem',
                        textDecoration: 'underline',
                        fontWeight: 500
                      }}
                      onMouseOver={(e) => e.target.style.color = '#1B3C53'}
                      onMouseOut={(e) => e.target.style.color = '#456882'}
                    >
                      {isSignMeUp ? 'Already have an account? Login' : "Don't have an account? Sign Up"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
        ) : (
          <PDFEditor token={token} onLogout={handleLogout} currentUser={currentUser} />
        )}
      </div>
    </GoogleOAuthProvider>
  )
}

export default App
