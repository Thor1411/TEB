import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import { spawn } from 'child_process'
import { PDFDocument } from 'pdf-lib'
import sharp from 'sharp'
import { dockerAvailable, runInDockerSandbox } from './sandbox.js'

const runPdftoppm = async ({ pdfPath, outputPrefix, timeoutMs, maxPages, dpi }) => {
  const args = []
  if (Number.isFinite(dpi) && dpi > 0) {
    args.push('-r', String(dpi))
  }
  if (Number.isFinite(maxPages) && maxPages > 0) {
    args.push('-f', '1', '-l', String(maxPages))
  }
  args.push('-png', pdfPath, outputPrefix)

  const useDocker = (process.env.SANDBOX_DOCKER || '1') !== '0'
  const hasDocker = useDocker ? await dockerAvailable() : false

  if (hasDocker) {
    const image = process.env.SANDBOX_IMAGE || 'secure-pdf-sanitizer:latest'
    // Paths are inside mounted /work
    const pdfRel = path.basename(pdfPath)
    const outRel = path.basename(outputPrefix)

    try {
      await runInDockerSandbox({
        image,
        workDir: path.dirname(pdfPath),
        cmd: 'pdftoppm',
        args: args.map((a) => {
          if (a === pdfPath) return pdfRel
          if (a === outputPrefix) return outRel
          return a
        }),
        timeoutMs
      })
      return
    } catch {
      // Fall back to local execution if the sandbox image isn't available.
    }
  }

  await new Promise((resolve, reject) => {
    const child = spawn('pdftoppm', args, {
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'pipe']
    })

    let stderr = ''
    child.stderr?.on('data', (d) => {
      stderr += d.toString()
      if (stderr.length > 10_000) stderr = stderr.slice(-10_000)
    })

    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error('pdftoppm timed out'))
    }, timeoutMs)

    child.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })

    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) return resolve()
      reject(new Error(`pdftoppm failed (code ${code}): ${stderr || 'unknown error'}`))
    })
  })
}

const naturalSortPages = (files) => {
  // pdftoppm produces: prefix-1.png, prefix-2.png ...
  return [...files].sort((a, b) => {
    const an = Number((a.match(/-(\d+)\.png$/) || [])[1] || 0)
    const bn = Number((b.match(/-(\d+)\.png$/) || [])[1] || 0)
    return an - bn
  })
}

export const sanitizePdfByRasterize = async ({
  pdfBytes,
  workDir,
  timeoutMs,
  maxPages,
  dpi = Number(process.env.SANITIZE_DPI || 200)
}) => {
  const jobId = crypto.randomUUID()
  const jobDir = path.join(workDir, `job-${jobId}`)
  await fs.mkdir(jobDir, { recursive: true })

  const inputPath = path.join(jobDir, 'input.pdf')
  const outPrefix = path.join(jobDir, 'page')

  try {
    await fs.writeFile(inputPath, Buffer.from(pdfBytes))

    // Best-effort: capture original page sizes so the rebuilt PDF preserves dimensions.
    let originalPageSizes = null
    try {
      const inDoc = await PDFDocument.load(pdfBytes)
      originalPageSizes = inDoc.getPages().map((p) => p.getSize())
    } catch {
      originalPageSizes = null
    }

    await runPdftoppm({
      pdfPath: inputPath,
      outputPrefix: outPrefix,
      timeoutMs,
      maxPages,
      dpi
    })

    const files = await fs.readdir(jobDir)
    const pages = naturalSortPages(files.filter((f) => f.startsWith('page-') && f.endsWith('.png')))
    if (pages.length === 0) {
      throw new Error('No pages produced during sanitization')
    }

    const outDoc = await PDFDocument.create()

    for (let i = 0; i < pages.length; i++) {
      const filename = pages[i]
      const imgBytes = await fs.readFile(path.join(jobDir, filename))
      const img = await outDoc.embedPng(imgBytes)
      const fallback = { width: img.width, height: img.height }
      const size = (originalPageSizes && originalPageSizes[i]) ? originalPageSizes[i] : fallback
      const page = outDoc.addPage([size.width, size.height])
      page.drawImage(img, { x: 0, y: 0, width: size.width, height: size.height })
    }

    const outBytes = await outDoc.save()
    return { bytes: outBytes, pageCount: pages.length }
  } finally {
    await fs.rm(jobDir, { recursive: true, force: true }).catch(() => {})
  }
}

export const redactPdfByRasterize = async ({
  pdfBytes,
  workDir,
  timeoutMs,
  maxPages,
  dpi = Number(process.env.SANITIZE_DPI || 200),
  // { [pageNumber: number]: Array<{x:number,y:number,width:number,height:number}> } in normalized coords (0..1)
  redactionsByPage
}) => {
  const jobId = crypto.randomUUID()
  const jobDir = path.join(workDir, `job-${jobId}`)
  await fs.mkdir(jobDir, { recursive: true })

  const inputPath = path.join(jobDir, 'input.pdf')
  const outPrefix = path.join(jobDir, 'page')

  try {
    await fs.writeFile(inputPath, Buffer.from(pdfBytes))

    let originalPageSizes = null
    try {
      const inDoc = await PDFDocument.load(pdfBytes)
      originalPageSizes = inDoc.getPages().map((p) => p.getSize())
    } catch {
      originalPageSizes = null
    }

    await runPdftoppm({
      pdfPath: inputPath,
      outputPrefix: outPrefix,
      timeoutMs,
      maxPages,
      dpi
    })

    const files = await fs.readdir(jobDir)
    const pages = naturalSortPages(files.filter((f) => f.startsWith('page-') && f.endsWith('.png')))
    if (pages.length === 0) {
      throw new Error('No pages produced during redaction')
    }

    // Apply redactions in-place on the rasterized PNGs.
    for (let i = 0; i < pages.length; i++) {
      const pageNumber = i + 1
      const rects = (redactionsByPage && redactionsByPage[pageNumber]) ? redactionsByPage[pageNumber] : []
      if (!Array.isArray(rects) || rects.length === 0) continue

      const imgPath = path.join(jobDir, pages[i])
      const img = sharp(imgPath)
      const meta = await img.metadata()
      const imgWidth = meta.width || 0
      const imgHeight = meta.height || 0
      if (!imgWidth || !imgHeight) continue

      const overlays = rects
        .filter(r => r && Number.isFinite(r.x) && Number.isFinite(r.y) && Number.isFinite(r.width) && Number.isFinite(r.height))
        .map((r) => {
          const left = Math.max(0, Math.min(imgWidth, Math.round(r.x * imgWidth)))
          const top = Math.max(0, Math.min(imgHeight, Math.round(r.y * imgHeight)))
          const w = Math.max(1, Math.min(imgWidth - left, Math.round(r.width * imgWidth)))
          const h = Math.max(1, Math.min(imgHeight - top, Math.round(r.height * imgHeight)))
          return {
            input: {
              create: {
                width: w,
                height: h,
                channels: 4,
                background: { r: 0, g: 0, b: 0, alpha: 1 }
              }
            },
            left,
            top
          }
        })

      if (overlays.length === 0) continue

      const outBuf = await img.composite(overlays).png().toBuffer()
      await fs.writeFile(imgPath, outBuf)
    }

    const outDoc = await PDFDocument.create()
    for (let i = 0; i < pages.length; i++) {
      const filename = pages[i]
      const imgBytes = await fs.readFile(path.join(jobDir, filename))
      const embedded = await outDoc.embedPng(imgBytes)
      const fallback = { width: embedded.width, height: embedded.height }
      const size = (originalPageSizes && originalPageSizes[i]) ? originalPageSizes[i] : fallback
      const page = outDoc.addPage([size.width, size.height])
      page.drawImage(embedded, { x: 0, y: 0, width: size.width, height: size.height })
    }

    const outBytes = await outDoc.save()
    return { bytes: outBytes, pageCount: pages.length }
  } finally {
    await fs.rm(jobDir, { recursive: true, force: true }).catch(() => {})
  }
}
