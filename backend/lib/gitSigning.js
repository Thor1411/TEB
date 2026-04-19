import crypto from 'crypto'

const canonicalize = (value) => {
  if (value == null) return value
  if (Array.isArray(value)) return value.map(canonicalize)
  if (typeof value === 'object') {
    const out = {}
    for (const k of Object.keys(value).sort()) {
      out[k] = canonicalize(value[k])
    }
    return out
  }
  return value
}

const sha256Hex = (bytes) => crypto.createHash('sha256').update(Buffer.from(bytes)).digest('hex')

const ensureGitKeyPair = () => {
  if (globalThis.__TEB_PDF_GIT_KEYPAIR) return globalThis.__TEB_PDF_GIT_KEYPAIR

  const envPriv = process.env.PDF_GIT_PRIVATE_KEY_PEM
  const envPub = process.env.PDF_GIT_PUBLIC_KEY_PEM

  if (envPriv) {
    const privateKey = envPriv
    const publicKey = envPub || crypto.createPublicKey(envPriv).export({ type: 'spki', format: 'pem' })
    globalThis.__TEB_PDF_GIT_KEYPAIR = { publicKey, privateKey, ephemeral: false }
    return globalThis.__TEB_PDF_GIT_KEYPAIR
  }

  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  })

  globalThis.__TEB_PDF_GIT_KEYPAIR = { publicKey, privateKey, ephemeral: true }
  return globalThis.__TEB_PDF_GIT_KEYPAIR
}

export const signGit = (gitObject) => {
  const { privateKey, publicKey, ephemeral } = ensureGitKeyPair()

  const clone = { ...gitObject }
  delete clone.signature

  const canonical = canonicalize(clone)
  const payload = Buffer.from(JSON.stringify(canonical), 'utf8')
  const digestHex = sha256Hex(payload)

  const digest = Buffer.from(digestHex, 'hex')
  const signature = crypto.sign('RSA-SHA256', digest, privateKey)

  return {
    alg: 'rsa-sha256',
    digestHex,
    signatureB64: signature.toString('base64'),
    publicKeyPem: publicKey,
    ephemeral
  }
}

export const verifyGitSignature = (gitObject, { trustedPublicKeyPem } = {}) => {
  const sig = gitObject?.signature
  if (!sig?.publicKeyPem || !sig?.signatureB64 || !sig?.digestHex) {
    return { ok: false, error: 'No signature' }
  }

  if (trustedPublicKeyPem) {
    const normalize = (s) => String(s).replace(/\r\n/g, '\n').trim()
    if (normalize(sig.publicKeyPem) !== normalize(trustedPublicKeyPem)) {
      return { ok: false, error: 'Untrusted signing key' }
    }
  }

  const clone = { ...gitObject }
  delete clone.signature
  const canonical = canonicalize(clone)
  const payload = Buffer.from(JSON.stringify(canonical), 'utf8')
  const digestHex = sha256Hex(payload)
  if (digestHex !== sig.digestHex) {
    return { ok: false, error: 'Digest mismatch' }
  }

  try {
    const ok = crypto.verify(
      'RSA-SHA256',
      Buffer.from(sig.digestHex, 'hex'),
      sig.publicKeyPem,
      Buffer.from(sig.signatureB64, 'base64')
    )
    return { ok, ephemeral: !!sig.ephemeral }
  } catch (e) {
    return { ok: false, error: e?.message || 'Verification failed' }
  }
}
