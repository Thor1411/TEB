import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'

const sha256Hex = (s) => crypto.createHash('sha256').update(s).digest('hex')

export const ensureDir = async (dir) => {
  await fs.mkdir(dir, { recursive: true })
}

export const appendAuditEvent = async ({ auditDir, docId, actor, action, details }) => {
  await ensureDir(auditDir)
  const logPath = path.join(auditDir, `${docId}.log`)

  let prevHash = '0'.repeat(64)
  try {
    const existing = await fs.readFile(logPath, 'utf8')
    const lines = existing.trim().split('\n').filter(Boolean)
    if (lines.length > 0) {
      const last = JSON.parse(lines[lines.length - 1])
      if (last?.hash) prevHash = last.hash
    }
  } catch {
    // no prior log
  }

  const event = {
    ts: new Date().toISOString(),
    actor: actor || null,
    action,
    details: details || null,
    prevHash
  }

  const payload = JSON.stringify(event)
  const hash = sha256Hex(prevHash + payload)
  const line = JSON.stringify({ ...event, hash }) + '\n'

  await fs.appendFile(logPath, line, 'utf8')

  // Optional DB mirror (non-authoritative)
  try {
    const { AuditEvent } = await import('../models/AuditEvent.js')
    if (AuditEvent?.create) {
      await AuditEvent.create({
        docId,
        ts: new Date(event.ts),
        actor: actor || null,
        action,
        details: details || null,
        prevHash,
        hash
      })
    }
  } catch {
    // ignore if DB not configured
  }

  return { ...event, hash }
}

export const readAuditLog = async ({ auditDir, docId, limit = 200 }) => {
  const logPath = path.join(auditDir, `${docId}.log`)
  const content = await fs.readFile(logPath, 'utf8').catch(() => '')
  const lines = content.trim().split('\n').filter(Boolean)
  const slice = lines.slice(Math.max(0, lines.length - limit))
  return slice.map((l) => JSON.parse(l))
}

export const verifyAuditLog = async ({ auditDir, docId }) => {
  const entries = await readAuditLog({ auditDir, docId, limit: 10_000 })
  let expectedPrev = '0'.repeat(64)
  for (const entry of entries) {
    const { hash, prevHash, ...event } = entry
    if (prevHash !== expectedPrev) {
      return { ok: false, error: 'Broken hash chain' }
    }
    const payload = JSON.stringify({ ...event, prevHash })
    const expectedHash = sha256Hex(prevHash + payload)
    if (hash !== expectedHash) {
      return { ok: false, error: 'Hash mismatch' }
    }
    expectedPrev = hash
  }
  return { ok: true, count: entries.length }
}
