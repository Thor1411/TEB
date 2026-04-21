#!/usr/bin/env node
import fs from 'fs/promises'
import path from 'path'
import process from 'process'

import mongoose from 'mongoose'
import { connectDb } from '../lib/db.js'

const args = new Set(process.argv.slice(2))
const yes = args.has('--yes') || args.has('-y')

const VAULT_DIR = process.env.VAULT_DIR || './secure_storage'
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'

const resolveFromCwd = (p) => (path.isAbsolute(p) ? p : path.resolve(process.cwd(), p))

const vaultDir = resolveFromCwd(VAULT_DIR)
const uploadDir = resolveFromCwd(UPLOAD_DIR)

const ensureDir = async (dir) => {
  await fs.mkdir(dir, { recursive: true })
}

const emptyDir = async (dir) => {
  await ensureDir(dir)
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => [])
  await Promise.all(
    entries.map((ent) => fs.rm(path.join(dir, ent.name), { recursive: true, force: true }))
  )
}

const fileExists = async (p) => {
  try {
    await fs.stat(p)
    return true
  } catch {
    return false
  }
}

const main = async () => {
  if (!yes) {
    console.error('Refusing to wipe data without confirmation.')
    console.error('Re-run with: node scripts/clear-storage.mjs --yes')
    process.exitCode = 2
    return
  }

  // Filesystem-backed storage
  const docsDir = path.join(vaultDir, 'docs')
  const metaDir = path.join(vaultDir, 'meta')
  const auditDir = path.join(vaultDir, 'audit')
  const usersFile = path.join(vaultDir, 'users.json')
  const masterKeyFile = path.join(vaultDir, 'master_key.dev')

  await ensureDir(vaultDir)
  await emptyDir(docsDir)
  await emptyDir(metaDir)
  await emptyDir(auditDir)
  await fs.writeFile(usersFile, '[]\n', 'utf8')

  if (!(await fileExists(masterKeyFile))) {
    // If someone deleted it, don't re-create here; vault init will handle it.
    console.warn('[warn] master_key.dev not found; leaving as-is')
  }

  // Uploads directory (wipes stored upload artifacts and work files)
  await ensureDir(uploadDir)
  const uploadEntries = await fs.readdir(uploadDir, { withFileTypes: true }).catch(() => [])
  for (const ent of uploadEntries) {
    const full = path.join(uploadDir, ent.name)
    if (ent.isDirectory() && ent.name === 'work') {
      await emptyDir(full)
      continue
    }
    await fs.rm(full, { recursive: true, force: true })
  }
  await ensureDir(path.join(uploadDir, 'work'))

  // Optional MongoDB-backed storage
  const db = await connectDb().catch(() => ({ enabled: false }))
  if (db?.enabled && mongoose.connection.readyState === 1) {
    const deletions = []

    try {
      const { User } = await import('../models/User.js')
      if (User?.deleteMany) deletions.push(User.deleteMany({}))
    } catch {
      // ignore
    }

    try {
      const { Document } = await import('../models/Document.js')
      if (Document?.deleteMany) deletions.push(Document.deleteMany({}))
    } catch {
      // ignore
    }

    try {
      const { AuditEvent } = await import('../models/AuditEvent.js')
      if (AuditEvent?.deleteMany) deletions.push(AuditEvent.deleteMany({}))
    } catch {
      // ignore
    }

    await Promise.allSettled(deletions)
    await mongoose.disconnect().catch(() => {})
  }

  console.log('OK: cleared users + documents + audit (filesystem + Mongo when enabled)')
  console.log(`VAULT_DIR=${vaultDir}`)
  console.log(`UPLOAD_DIR=${uploadDir}`)
}

await main()
