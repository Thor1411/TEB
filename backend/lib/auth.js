import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'

const VAULT_DIR = process.env.VAULT_DIR || './secure_storage'
const USERS_FILE = path.join(VAULT_DIR, 'users.json')

const normalizeEmail = (email) => String(email || '').trim().toLowerCase()

const readDiskUsers = async () => {
  try {
    const raw = await fs.readFile(USERS_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const writeDiskUsers = async (users) => {
  await fs.mkdir(path.dirname(USERS_FILE), { recursive: true })
  const tmp = `${USERS_FILE}.tmp`
  await fs.writeFile(tmp, JSON.stringify(users, null, 2), 'utf8')
  await fs.rename(tmp, USERS_FILE)
}

const upsertDiskUser = async (user) => {
  const users = await readDiskUsers()
  const email = normalizeEmail(user.email)
  const idx = users.findIndex(u => normalizeEmail(u.email) === email)
  if (idx >= 0) {
    users[idx] = { ...users[idx], ...user, email: users[idx].email }
  } else {
    users.push(user)
  }
  await writeDiskUsers(users)
}

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
    name: 'Administrator',
    email: 'admin@example.com',
    username: 'admin',
    passwordHash: bcrypt.hashSync(process.env.DEFAULT_ADMIN_PASSWORD || 'admin123', 10),
    roles: ['admin']
  }
]

export const getUsers = () => DEFAULT_USERS

export const getUserByEmail = async (email) => {
  try {
    const { User } = await import('../models/User.js')
    if (User?.findOne) {
      // Check if mongoose is connected
      const mongoose = (await import('mongoose')).default
      if (mongoose.connection.readyState === 1) {
        const user = await User.findOne({ $or: [{ email }, { username: email }] })
        if (user) {
          return {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            username: user.username,
            passwordHash: user.passwordHash,
            roles: user.roles
          }
        }
        return null
      }
    }
  } catch {
    // ignore
  }

  // Fallback to filesystem-backed store (survives restarts)
  const key = normalizeEmail(email)
  const diskUsers = await readDiskUsers()
  const diskUser = diskUsers.find(u => normalizeEmail(u.email) === key || String(u.username || '').toLowerCase() === key)
  if (diskUser) return diskUser

  // Fallback to in-memory (demo)
  return DEFAULT_USERS.find(u => normalizeEmail(u.email) === key || String(u.username || '').toLowerCase() === key) || null
}

export const createUser = async (name, email, password) => {
  const existing = await getUserByEmail(email)
  if (existing) {
    throw new Error('User already exists')
  }

  const passwordHash = bcrypt.hashSync(password, 10)
  const roles = ['user']

  try {
    const { User } = await import('../models/User.js')
    if (User?.create) {
      const mongoose = (await import('mongoose')).default
      if (mongoose.connection.readyState === 1) {
        const newUser = await User.create({ name, email, passwordHash, roles })
        return {
          id: newUser._id.toString(),
          name: newUser.name,
          email: newUser.email,
          passwordHash: newUser.passwordHash,
          roles: newUser.roles
        }
      }
    }
  } catch {
    // ignore
  }

  // Fallback to filesystem-backed store (and mirror in memory)
  const id = crypto.randomUUID()
  const normalizedEmail = normalizeEmail(email)
  const newUser = { id, name, email: normalizedEmail, username: normalizedEmail, passwordHash, roles }
  await upsertDiskUser(newUser)
  DEFAULT_USERS.push(newUser)
  return newUser
}

export const ensureAdminUser = async () => {
  try {
    const { User } = await import('../models/User.js')
    if (!User?.findOne) return

    const username = process.env.DEFAULT_ADMIN_USERNAME || 'admin'
    const email = 'admin@example.com'
    const name = 'Administrator'
    const password = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123'
    const roles = ['admin']
    const existing = await User.findOne({ $or: [{ email }, { username }] })
    if (existing) return

    const passwordHash = bcrypt.hashSync(password, 10)
    await User.create({ name, email, username, passwordHash, roles })
    // eslint-disable-next-line no-console
    console.log(`[seed] created admin user: ${email}`)
  } catch {
    // ignore when DB not enabled
  }
}

export const signAccessToken = (user) => {
  ensureJwtSecret()
  return jwt.sign(
    { sub: user.id, name: user.name, email: user.email, username: user.username, roles: user.roles },
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
      name: payload.name,
      email: payload.email,
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
