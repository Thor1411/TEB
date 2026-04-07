import crypto from 'crypto'

const ensureKeyPair = () => {
  // Platform-level signatures (sign the PDF bytes hash). Not an embedded PDF signature.
  // For true PDF signatures (AcroForm/PAdES), integrate a dedicated PDF signing library.
  if (globalThis.__PDF_PLATFORM_KEYPAIR) return globalThis.__PDF_PLATFORM_KEYPAIR

  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  })

  globalThis.__PDF_PLATFORM_KEYPAIR = { publicKey, privateKey }
  return globalThis.__PDF_PLATFORM_KEYPAIR
}

export const signPdfBytes = (pdfBytes) => {
  const { privateKey } = ensureKeyPair()
  const digest = crypto.createHash('sha256').update(Buffer.from(pdfBytes)).digest()
  const signature = crypto.sign('RSA-SHA256', digest, privateKey)
  return {
    digest: digest.toString('base64'),
    signature: signature.toString('base64')
  }
}

export const verifyPdfBytes = (pdfBytes, signatureRecord) => {
  if (!signatureRecord?.digest || !signatureRecord?.signature) return { ok: false, error: 'No signature' }

  const { publicKey } = ensureKeyPair()
  const digest = crypto.createHash('sha256').update(Buffer.from(pdfBytes)).digest()
  const expectedDigestB64 = digest.toString('base64')
  if (signatureRecord.digest !== expectedDigestB64) {
    return { ok: false, error: 'Digest mismatch' }
  }

  const sig = Buffer.from(signatureRecord.signature, 'base64')
  const ok = crypto.verify('RSA-SHA256', digest, publicKey, sig)
  return { ok }
}
