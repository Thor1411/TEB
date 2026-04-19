import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import sharp from 'sharp'

import { runPdftoppmPng } from './pdftoppm.js'

const sha256Hex = (buf) => crypto.createHash('sha256').update(buf).digest('hex')

const parsePdftoppmIndex = (filename, prefix) => {
  // pdftoppm emits: <prefix>-1.png
  const base = path.basename(filename)
  const m = base.match(new RegExp(`^${prefix}-(\\d+)\\.png$`))
  if (!m) return null
  return Number(m[1])
}

export const computePagePixelHashes = async ({ pdfBytes, workDir, timeoutMs }) => {
  const tempId = crypto.randomUUID()
  const pdfPath = path.join(workDir, `teb-git-hash-${tempId}.pdf`)
  const outputPrefix = path.join(workDir, `teb-git-hash-${tempId}`)

  await fs.writeFile(pdfPath, Buffer.from(pdfBytes))

  try {
    await runPdftoppmPng({ pdfPath, outputPrefix, timeoutMs })

    const files = await fs.readdir(workDir)
    const pngs = files
      .filter(f => f.startsWith(`teb-git-hash-${tempId}-`) && f.endsWith('.png'))
      .map(f => path.join(workDir, f))

    const pageEntries = []
    for (const pngPath of pngs) {
      const idx = parsePdftoppmIndex(pngPath, `teb-git-hash-${tempId}`)
      if (!Number.isFinite(idx)) continue

      const img = sharp(pngPath)
      const meta = await img.metadata()
      const raw = await img.ensureAlpha().raw().toBuffer()
      const digest = sha256Hex(raw)

      pageEntries.push({
        page: idx,
        alg: 'sha256-raw-rgba',
        width: meta.width || null,
        height: meta.height || null,
        digest
      })
    }

    pageEntries.sort((a, b) => a.page - b.page)
    return pageEntries
  } finally {
    // Cleanup
    await fs.unlink(pdfPath).catch(() => {})
    const files = await fs.readdir(workDir).catch(() => [])
    await Promise.all(
      files
        .filter(f => f.startsWith(`teb-git-hash-${tempId}-`) && f.endsWith('.png'))
        .map(f => fs.unlink(path.join(workDir, f)).catch(() => {}))
    )
  }
}
