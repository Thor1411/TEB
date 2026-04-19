import crypto from 'crypto'
import {
  PDFDocument,
  PDFName,
  PDFDict,
  PDFArray,
  PDFString,
  PDFHexString,
  decodePDFRawStream
} from 'pdf-lib'

const GIT_ATTACHMENT_NAME = 'teb-git.json'

const sha256Hex = (bytes) => crypto.createHash('sha256').update(Buffer.from(bytes)).digest('hex')

const safeJsonParse = (s) => {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

const asString = (pdfStr) => {
  if (!pdfStr) return null
  if (pdfStr instanceof PDFString) return pdfStr.decodeText()
  if (pdfStr instanceof PDFHexString) return pdfStr.decodeText()
  return null
}

const findInNameTree = (nameTreeDict, targetName, depth = 0) => {
  if (!nameTreeDict || depth > 10) return null

  const names = nameTreeDict.lookupMaybe(PDFName.of('Names'), PDFArray)
  if (names) {
    // Alternating [name, value, name, value, ...]
    for (let i = 0; i < names.size(); i += 2) {
      const key = asString(names.lookup(i))
      const value = names.lookup(i + 1)
      if (key === targetName) return value
    }
    return null
  }

  const kids = nameTreeDict.lookupMaybe(PDFName.of('Kids'), PDFArray)
  if (kids) {
    for (let i = 0; i < kids.size(); i++) {
      const kid = kids.lookup(i, PDFDict)
      const found = findInNameTree(kid, targetName, depth + 1)
      if (found) return found
    }
  }

  return null
}

const removeFromNameTree = (nameTreeDict, targetName, depth = 0) => {
  if (!nameTreeDict || depth > 10) return false
  const names = nameTreeDict.lookupMaybe(PDFName.of('Names'), PDFArray)
  if (names) {
    let removed = false
    // Work backwards so index shifts don’t matter
    for (let i = names.size() - 2; i >= 0; i -= 2) {
      const key = asString(names.lookup(i))
      if (key === targetName) {
        names.remove(i + 1)
        names.remove(i)
        removed = true
      }
    }
    return removed
  }

  const kids = nameTreeDict.lookupMaybe(PDFName.of('Kids'), PDFArray)
  if (kids) {
    let removed = false
    for (let i = 0; i < kids.size(); i++) {
      const kid = kids.lookup(i, PDFDict)
      removed = removeFromNameTree(kid, targetName, depth + 1) || removed
    }
    return removed
  }

  return false
}

export const readPdfGit = async (pdfBytes) => {
  const pdfDoc = await PDFDocument.load(pdfBytes)
  const names = pdfDoc.catalog.lookupMaybe(PDFName.of('Names'), PDFDict)
  if (!names) return { git: null, raw: null }

  const embeddedFiles = names.lookupMaybe(PDFName.of('EmbeddedFiles'), PDFDict)
  if (!embeddedFiles) return { git: null, raw: null }

  const fileSpec = findInNameTree(embeddedFiles, GIT_ATTACHMENT_NAME)
  if (!fileSpec) return { git: null, raw: null }

  const fileSpecDict = fileSpec instanceof PDFDict ? fileSpec : null
  if (!fileSpecDict) return { git: null, raw: null }

  const ef = fileSpecDict.lookupMaybe(PDFName.of('EF'), PDFDict)
  if (!ef) return { git: null, raw: null }

  let embeddedStream = null
  try {
    embeddedStream = ef.lookup(PDFName.of('F'))
  } catch {
    embeddedStream = null
  }
  if (!embeddedStream) return { git: null, raw: null }

  // `decodePDFRawStream` returns a pdf.js DecodeStream; use getBytes().
  const decoded = decodePDFRawStream(embeddedStream).getBytes()
  const raw = Uint8Array.from(decoded)
  const json = safeJsonParse(Buffer.from(raw).toString('utf8'))
  return { git: json, raw }
}

export const writePdfGit = async (pdfBytes, gitObject) => {
  const pdfDoc = await PDFDocument.load(pdfBytes)

  // Best-effort: remove prior copies to avoid file bloat.
  const names = pdfDoc.catalog.lookupMaybe(PDFName.of('Names'), PDFDict)
  if (names) {
    const embeddedFiles = names.lookupMaybe(PDFName.of('EmbeddedFiles'), PDFDict)
    if (embeddedFiles) removeFromNameTree(embeddedFiles, GIT_ATTACHMENT_NAME)
  }

  const payload = Buffer.from(JSON.stringify(gitObject, null, 2), 'utf8')
  pdfDoc.attach(payload, GIT_ATTACHMENT_NAME, {
    mimeType: 'application/json',
    description: 'TEB PDF Git metadata'
  })

  // Mirror a small fingerprint in regular metadata for quick inspection.
  const fp = sha256Hex(payload).slice(0, 16)
  try {
    pdfDoc.setKeywords([`TEB_GIT:${fp}`])
  } catch {
    // ignore
  }

  const out = await pdfDoc.save()
  return out
}

export const createEmptyGitRepo = ({ actor, pageCount }) => {
  const repoId = crypto.randomUUID()
  const now = new Date().toISOString()

  const initCommitId = crypto.randomUUID()
  const initCommit = {
    id: initCommitId,
    ts: now,
    actor: actor || null,
    message: 'Initialize PDF Git',
    parent: null,
    actions: [{ type: 'init', pageCount }],
    pageHashes: [],
    commitHash: null
  }

  const commitHash = sha256Hex(Buffer.from(JSON.stringify({ ...initCommit, commitHash: null }), 'utf8'))
  initCommit.commitHash = commitHash

  return {
    tebPdfGit: true,
    schema: 1,
    repoId,
    initializedAt: now,
    head: initCommitId,
    branches: { main: initCommitId },
    commits: { [initCommitId]: initCommit },
    signature: null
  }
}

export const appendGitCommit = ({ git, actor, message, actions, pageHashes }) => {
  const now = new Date().toISOString()
  const parentId = git?.head || null
  const parentCommit = parentId ? git?.commits?.[parentId] : null
  const parentHash = parentCommit?.commitHash || '0'.repeat(64)

  const id = crypto.randomUUID()
  const commit = {
    id,
    ts: now,
    actor: actor || null,
    message: message || 'Edit PDF',
    parent: parentId,
    actions: Array.isArray(actions) ? actions : [],
    pageHashes: Array.isArray(pageHashes) ? pageHashes : [],
    commitHash: null
  }

  const commitHash = sha256Hex(Buffer.from(parentHash + JSON.stringify({ ...commit, commitHash: null }), 'utf8'))
  commit.commitHash = commitHash

  const next = {
    ...git,
    head: id,
    branches: { ...(git.branches || {}), main: id },
    commits: { ...(git.commits || {}), [id]: commit }
  }

  return next
}
