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
  const hasByteRange = buf.includes(Buffer.from('/ByteRange'))
  const hasContents = buf.includes(Buffer.from('/Contents'))
  const hasSigField = buf.includes(Buffer.from('/Sig'))
  return {
    hasByteRange,
    hasContents,
    hasSigField,
    looksSigned: hasByteRange && hasContents
  }
}
