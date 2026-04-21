#!/usr/bin/env node
import fs from 'fs/promises'
import path from 'path'
import process from 'process'

import { readPdfGit } from '../lib/pdfGit.js'

const usage = () => {
  const cmd = path.basename(process.argv[1] || 'pdf-git-extract.mjs')
  console.error(`Usage:\n  node ${cmd} <input.pdf> [output.json]\n\nExtracts the embedded TEB PDF Git metadata (teb-git.json) from a PDF.\nIf output.json is omitted, prints the JSON to stdout.`)
}

const main = async () => {
  const [, , inputPdf, outputJson] = process.argv
  if (!inputPdf) {
    usage()
    process.exit(2)
  }

  const pdfBytes = await fs.readFile(inputPdf)
  const { git } = await readPdfGit(pdfBytes)

  if (!git?.tebPdfGit) {
    console.error('No embedded TEB PDF Git metadata found in this PDF.')
    process.exit(1)
  }

  const out = JSON.stringify(git, null, 2)
  if (outputJson) {
    await fs.writeFile(outputJson, out, 'utf8')
    console.error(`Wrote: ${outputJson}`)
  } else {
    process.stdout.write(out + '\n')
  }
}

main().catch((e) => {
  console.error(e?.stack || e?.message || String(e))
  process.exit(1)
})
