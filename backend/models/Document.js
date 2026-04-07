import mongoose from 'mongoose'

const SignatureSchema = new mongoose.Schema(
  {
    digest: { type: String },
    signature: { type: String },
    type: { type: String } // 'platform' | 'embedded'
  },
  { _id: false }
)

const DocumentSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // UUID
    ownerId: { type: String, required: true, index: true },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
    pageCount: { type: Number, required: true },

    // Encrypted blob is stored on disk in VAULT_DIR/docs/<id>.bin
    iv: { type: String, required: true },
    tag: { type: String, required: true },

    parentId: { type: String, default: null, index: true },
    signature: { type: SignatureSchema, default: null }
  },
  { versionKey: false }
)

export const Document = mongoose.models.Document || mongoose.model('Document', DocumentSchema)
