import { SignPdf } from '@signpdf/signpdf'
import { pdflibAddPlaceholder } from '@signpdf/placeholder-pdf-lib'

export const signPdfEmbedded = async ({
  pdfBytes,
  p12Buffer,
  passphrase,
  reason = 'Document signed'
}) => {
  const pdfBuffer = Buffer.from(pdfBytes)

  const pdfWithPlaceholder = await pdflibAddPlaceholder({
    pdfBuffer,
    reason,
    signatureLength: 16_384
  })

  const signer = new SignPdf()
  const signedBuffer = signer.sign(pdfWithPlaceholder, p12Buffer, { passphrase })
  return new Uint8Array(signedBuffer)
}

export const inspectEmbeddedSignature = (pdfBytes) => {
  const buf = Buffer.from(pdfBytes)
  // Use latin1 to keep a 1:1 byte->char mapping (safe for scanning tokens).
  const s = buf.toString('latin1')

  const issues = []

  const hasByteRange = s.includes('/ByteRange')
  const hasContents = s.includes('/Contents')
  const hasSigField = s.includes('/Sig') || s.includes('/Type/Sig') || s.includes('/Type /Sig')

  const byteRangeMatch = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/m.exec(s)
  const byteRange = byteRangeMatch
    ? byteRangeMatch.slice(1, 5).map((n) => Number(n))
    : null

  let validByteRange = false
  if (byteRange && byteRange.length === 4 && byteRange.every(Number.isFinite)) {
    const [a, b, c, d] = byteRange
    const fileLen = buf.length
    const within = (x) => x >= 0 && x <= fileLen

    // ByteRange is typically: [0, len1, offset2, len2]
    if (!within(a) || !within(b) || !within(c) || !within(d)) {
      issues.push('ByteRange values out of bounds')
    } else if (a !== 0) {
      issues.push('ByteRange does not start at 0')
    } else if (b <= 0 || d <= 0) {
      issues.push('ByteRange lengths are invalid')
    } else if (c < a + b) {
      issues.push('ByteRange second offset overlaps first range')
    } else if (c + d > fileLen) {
      issues.push('ByteRange extends past end of file')
    } else {
      const gap = c - (a + b)
      if (gap <= 0) issues.push('ByteRange gap is missing (no signature placeholder space)')
      validByteRange = issues.length === 0
    }
  } else if (hasByteRange) {
    issues.push('ByteRange marker found but could not parse values')
  }

  // Try to extract the signature Contents hex blob.
  // We limit the scan window for performance (signature dictionary is usually near ByteRange).
  const scanStart = byteRangeMatch ? byteRangeMatch.index : 0
  const scan = s.slice(scanStart, scanStart + 200_000)
  const contentsMatch = /\/Contents\s*<\s*([0-9A-Fa-f\s]+)\s*>/m.exec(scan)
  const contentsHexRaw = contentsMatch ? contentsMatch[1] : null
  const contentsHex = contentsHexRaw ? contentsHexRaw.replace(/\s+/g, '') : null
  const contentsHexLength = contentsHex ? contentsHex.length : 0
  const contentsIsAllZeros = contentsHex ? /^0+$/i.test(contentsHex) : false
  const contentsBytesLength = contentsHex ? Math.floor(contentsHex.length / 2) : 0

  if (hasContents && !contentsHex) {
    issues.push('Contents marker found but could not extract signature hex')
  }
  if (contentsHex && contentsHex.length < 20) {
    issues.push('Signature Contents appears too small')
  }
  if (contentsHex && contentsIsAllZeros) {
    issues.push('Signature Contents is all zeros (placeholder, not signed)')
  }

  const looksSigned = validByteRange && Boolean(contentsHex) && !contentsIsAllZeros

  return {
    hasByteRange,
    hasContents,
    hasSigField,
    looksSigned,
    byteRange,
    validByteRange,
    contentsHexLength,
    contentsBytesLength,
    contentsIsAllZeros,
    issues
  }
}
