import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'

export const ensureDir = async (dir) => {
  await fs.mkdir(dir, { recursive: true })
}

const mustGetMasterKey = () => {
  const raw = process.env.MASTER_KEY || ''
  if (!raw) {
    // Dev fallback: random key per process (docs will be undecryptable after restart)
    if (!globalThis.__PDF_VAULT_MASTER_KEY) {
      globalThis.__PDF_VAULT_MASTER_KEY = crypto.randomBytes(32)
    }
    return { key: globalThis.__PDF_VAULT_MASTER_KEY, ephemeral: true }
  }

  // Allow base64 or hex
  let key
  try {
    if (/^[0-9a-fA-F]{64}$/.test(raw)) {
      key = Buffer.from(raw, 'hex')
    } else {
      key = Buffer.from(raw, 'base64')
    }
  } catch {
    throw new Error('MASTER_KEY must be base64 or 64-hex characters')
  }

  if (key.length !== 32) {
    throw new Error('MASTER_KEY must be 32 bytes')
  }

  return { key, ephemeral: false }
}

const deriveDocKey = (masterKey, docId) => {
  // Deterministic per-document key (MVP). Rotate by re-encrypting with new MASTER_KEY.
  const salt = Buffer.from(docId, 'utf8')
  return crypto.hkdfSync('sha256', masterKey, salt, Buffer.from('pdf-vault'), 32)
}

export const encryptBytesForDoc = (docId, plaintextBytes) => {
  const { key: masterKey } = mustGetMasterKey()
  const docKey = deriveDocKey(masterKey, docId)

  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', docKey, iv)
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(plaintextBytes)), cipher.final()])
  const tag = cipher.getAuthTag()

  return { ciphertext, iv: iv.toString('base64'), tag: tag.toString('base64') }
}

export const decryptBytesForDoc = (docId, { ciphertext, ivB64, tagB64 }) => {
  const { key: masterKey } = mustGetMasterKey()
  const docKey = deriveDocKey(masterKey, docId)

  const iv = Buffer.from(ivB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')

  const decipher = crypto.createDecipheriv('aes-256-gcm', docKey, iv)
  decipher.setAuthTag(tag)
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return plaintext
}

export const initVault = async (vaultDir) => {
  const docsDir = path.join(vaultDir, 'docs')
  const metaDir = path.join(vaultDir, 'meta')
  const auditDir = path.join(vaultDir, 'audit')

  await ensureDir(vaultDir)
  await ensureDir(docsDir)
  await ensureDir(metaDir)
  await ensureDir(auditDir)

  return { docsDir, metaDir, auditDir }
}

const isMongoConnected = async () => {
  try {
    const mongoose = (await import('mongoose')).default
    return mongoose?.connection?.readyState === 1
  } catch {
    return false
  }
}

const metaPath = (metaDir, docId) => path.join(metaDir, `${docId}.json`)
const blobPath = (docsDir, docId) => path.join(docsDir, `${docId}.bin`)

export const writeDoc = async ({ docsDir, metaDir }, docId, payload) => {
  const { ciphertext, iv, tag } = encryptBytesForDoc(docId, payload.bytes)

  await fs.writeFile(blobPath(docsDir, docId), ciphertext)

  const meta = {
    _id: docId,
    ownerId: payload.ownerId,
    createdAt: new Date(payload.createdAt),
    updatedAt: new Date(payload.updatedAt),
    pageCount: payload.pageCount,
    iv,
    tag,
    signature: payload.signature || null,
    parentId: payload.parentId || null
  }

  if (await isMongoConnected()) {
    const { Document } = await import('../models/Document.js')
    await Document.create(meta)
  } else {
    // JSON fallback
    const jsonMeta = { id: docId, ...meta, createdAt: meta.createdAt.toISOString(), updatedAt: meta.updatedAt.toISOString() }
    await fs.writeFile(metaPath(metaDir, docId), JSON.stringify(jsonMeta, null, 2), 'utf8')
  }

  return { id: docId, ...meta }
}

export const readDocMeta = async ({ metaDir }, docId) => {
  if (await isMongoConnected()) {
    const { Document } = await import('../models/Document.js')
    const doc = await Document.findById(docId).lean()
    if (!doc) throw new Error('Document not found')
    return { ...doc, id: doc._id }
  }

  const raw = await fs.readFile(metaPath(metaDir, docId), 'utf8')
  return JSON.parse(raw)
}

export const writeDocMeta = async ({ metaDir }, docId, nextMeta) => {
  if (await isMongoConnected()) {
    const { Document } = await import('../models/Document.js')
    await Document.updateOne({ _id: docId }, { $set: nextMeta })
    return nextMeta
  }

  await fs.writeFile(metaPath(metaDir, docId), JSON.stringify(nextMeta, null, 2), 'utf8')
  return nextMeta
}

export const readDocBytes = async ({ docsDir, metaDir }, docId) => {
  const meta = await readDocMeta({ metaDir }, docId)
  const ciphertext = await fs.readFile(blobPath(docsDir, docId))
  const bytes = decryptBytesForDoc(docId, {
    ciphertext,
    ivB64: meta.iv,
    tagB64: meta.tag
  })
  return { meta, bytes }
}

export const listDocsForOwner = async ({ metaDir }, ownerId) => {
  if (await isMongoConnected()) {
    const { Document } = await import('../models/Document.js')
    const docs = await Document.find({ ownerId }).sort({ updatedAt: -1, createdAt: -1 }).lean()
    return docs.map(d => ({ ...d, id: d._id }))
  }

  const files = await fs.readdir(metaDir)
  const metas = []
  for (const f of files) {
    if (!f.endsWith('.json')) continue
    const raw = await fs.readFile(path.join(metaDir, f), 'utf8').catch(() => null)
    if (!raw) continue
    const meta = JSON.parse(raw)
    if (meta.ownerId === ownerId) metas.push(meta)
  }
  metas.sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)))
  return metas
}
