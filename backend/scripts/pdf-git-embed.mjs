#!/usr/bin/env node
import fs from 'fs/promises'
import path from 'path'
import process from 'process'

import { writePdfGit } from '../lib/pdfGit.js'

const usage = () => {
  const cmd = path.basename(process.argv[1] || 'pdf-git-embed.mjs')
  console.error(`Usage:\n  node ${cmd} <input.pdf> <git.json> <output.pdf>\n\nRe-embeds (or adds) TEB PDF Git metadata into a PDF as an embedded file named "teb-git.json".\nThis is useful after editing the PDF in an external editor that stripped attachments.`)
}

const main = async () => {
  const [, , inputPdf, gitJson, outputPdf] = process.argv
  if (!inputPdf || !gitJson || !outputPdf) {
    usage()
    process.exit(2)
  }

  const pdfBytes = await fs.readFile(inputPdf)
  const gitRaw = await fs.readFile(gitJson, 'utf8')

  let git
  try {
    git = JSON.parse(gitRaw)
  } catch {
    console.error('Invalid JSON in git.json')
    process.exit(2)
  }

  if (!git?.tebPdfGit) {
    console.error('git.json does not look like a TEB PDF Git object (missing tebPdfGit=true).')
    process.exit(2)
  }

  const outBytes = await writePdfGit(pdfBytes, git)
  await fs.writeFile(outputPdf, Buffer.from(outBytes))
  console.error(`Wrote: ${outputPdf}`)
}

main().catch((e) => {
  console.error(e?.stack || e?.message || String(e))
  process.exit(1)
})
