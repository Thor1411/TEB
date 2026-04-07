import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const getJwtSecret = () => {
  const raw = process.env.JWT_SECRET || ''
  if (raw) return raw
  if (!globalThis.__PDF_JWT_SECRET) {
    globalThis.__PDF_JWT_SECRET = crypto.randomBytes(32).toString('base64')
    // eslint-disable-next-line no-console
    console.warn('[security] JWT_SECRET not set; using ephemeral secret (tokens break on restart). Set JWT_SECRET in env for production.')
  }
  return globalThis.__PDF_JWT_SECRET
}

export const ensureJwtSecret = () => {
  getJwtSecret()
}

// Demo user store (replace with DB in production)
const DEFAULT_USERS = [
  {
    id: 'admin',
    username: 'admin',
    // password: admin123
    passwordHash: bcrypt.hashSync(process.env.DEFAULT_ADMIN_PASSWORD || 'admin123', 10),
    roles: ['admin']
  }
]

export const getUsers = () => DEFAULT_USERS

export const ensureAdminUser = async () => {
  try {
    const { User } = await import('../models/User.js')
    if (!User?.findOne) return

    const username = process.env.DEFAULT_ADMIN_USERNAME || 'admin'
    const password = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123'
    const roles = ['admin']
    const existing = await User.findOne({ username })
    if (existing) return

    const passwordHash = bcrypt.hashSync(password, 10)
    await User.create({ username, passwordHash, roles })
    // eslint-disable-next-line no-console
    console.log(`[seed] created admin user: ${username}`)
  } catch {
    // ignore when DB not enabled
  }
}

export const signAccessToken = (user) => {
  ensureJwtSecret()
  return jwt.sign(
    { sub: user.id, username: user.username, roles: user.roles },
    getJwtSecret(),
    { expiresIn: '8h' }
  )
}

export const authenticate = (req, res, next) => {
  try {
    ensureJwtSecret()
    const auth = req.headers.authorization || ''
    const [scheme, token] = auth.split(' ')
    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ error: 'Missing Bearer token' })
    }

    const payload = jwt.verify(token, getJwtSecret())
    req.user = {
      id: payload.sub,
      username: payload.username,
      roles: payload.roles || []
    }
    next()
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' })
  }
}

export const requireRole = (role) => (req, res, next) => {
  const roles = req.user?.roles || []
  if (!roles.includes(role)) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  next()
}
