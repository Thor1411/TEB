import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import { spawn } from 'child_process'
import sharp from 'sharp'
import { dockerAvailable, runInDockerSandbox } from './sandbox.js'

const spawnWithTimeout = async ({ cmd, args, timeoutMs }) => {
  return await new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let stdout = ''
    let stderr = ''

    child.stdout?.on('data', (d) => {
      stdout += d.toString()
      if (stdout.length > 5_000_000) stdout = stdout.slice(-5_000_000)
    })

    child.stderr?.on('data', (d) => {
      stderr += d.toString()
      if (stderr.length > 100_000) stderr = stderr.slice(-100_000)
    })

    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error(`${cmd} timed out`))
    }, timeoutMs)

    child.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })

    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) return resolve({ stdout, stderr })
      reject(new Error(`${cmd} failed (code ${code}): ${stderr || 'unknown error'}`))
    })
  })
}

const runPdftoppmSinglePagePng = async ({ pdfPath, outputPrefix, timeoutMs, dpi, page }) => {
  const args = []
  if (Number.isFinite(dpi) && dpi > 0) args.push('-r', String(dpi))
  args.push('-f', String(page), '-l', String(page), '-singlefile', '-png', pdfPath, outputPrefix)

  const useDocker = (process.env.SANDBOX_DOCKER || '1') !== '0'
  const hasDocker = useDocker ? await dockerAvailable() : false

  if (hasDocker) {
    const image = process.env.SANDBOX_IMAGE || 'secure-pdf-sanitizer:latest'
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
      // Fall back to local execution.
    }
  }

  await spawnWithTimeout({ cmd: 'pdftoppm', args, timeoutMs })
}

const parseTesseractTsvWords = ({ tsv, imageWidth, imageHeight }) => {
  const lines = String(tsv || '').split(/\r?\n/)
  if (lines.length === 0) return []

  const header = lines[0].split('\t')
  const idx = new Map(header.map((name, i) => [name, i]))
  const required = ['level', 'left', 'top', 'width', 'height', 'conf', 'text']
  for (const key of required) {
    if (!idx.has(key)) return []
  }

  const words = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue
    const cols = line.split('\t')

    const level = Number(cols[idx.get('level')])
    if (level !== 5) continue

    const text = (cols[idx.get('text')] || '').trim()
    if (!text) continue

    const left = Number(cols[idx.get('left')])
    const top = Number(cols[idx.get('top')])
    const width = Number(cols[idx.get('width')])
    const height = Number(cols[idx.get('height')])
    const conf = Number(cols[idx.get('conf')])

    if (![left, top, width, height].every(Number.isFinite)) continue
    if (!imageWidth || !imageHeight) continue

    const x = Math.max(0, Math.min(1, left / imageWidth))
    const y = Math.max(0, Math.min(1, top / imageHeight))
    const w = Math.max(0, Math.min(1, width / imageWidth))
    const h = Math.max(0, Math.min(1, height / imageHeight))

    words.push({ text, conf, x, y, width: w, height: h })
  }

  return words
}

export const ocrPdfPageWords = async ({
  pdfBytes,
  workDir,
  timeoutMs,
  page,
  dpi = Number(process.env.OCR_DPI || 200),
  lang = process.env.OCR_LANG || 'eng'
}) => {
  const jobId = crypto.randomUUID()
  const jobDir = path.join(workDir, `ocr-${jobId}`)
  await fs.mkdir(jobDir, { recursive: true })

  const inputPath = path.join(jobDir, 'input.pdf')
  const outPrefix = path.join(jobDir, 'page')
  const outPng = `${outPrefix}.png`

  try {
    await fs.writeFile(inputPath, Buffer.from(pdfBytes))

    await runPdftoppmSinglePagePng({
      pdfPath: inputPath,
      outputPrefix: outPrefix,
      timeoutMs,
      dpi,
      page
    })

    const meta = await sharp(outPng).metadata()
    const imageWidth = meta.width || 0
    const imageHeight = meta.height || 0
    if (!imageWidth || !imageHeight) {
      throw new Error('Failed to read rasterized page dimensions')
    }

    const cmd = process.env.TESSERACT_CMD || 'tesseract'
    const psm = Number(process.env.TESSERACT_PSM || 6)
    const args = [
      outPng,
      'stdout',
      '--dpi',
      String(dpi),
      '-l',
      String(lang || 'eng'),
      '--psm',
      String(Number.isFinite(psm) ? psm : 6),
      'tsv'
    ]

    const { stdout: tsv } = await spawnWithTimeout({ cmd, args, timeoutMs })
    const words = parseTesseractTsvWords({ tsv, imageWidth, imageHeight })

    return { page, dpi, lang, imageWidth, imageHeight, words }
  } finally {
    await fs.rm(jobDir, { recursive: true, force: true }).catch(() => {})
  }
}
