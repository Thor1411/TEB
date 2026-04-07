import mongoose from 'mongoose'

const AuditEventSchema = new mongoose.Schema(
  {
    docId: { type: String, required: true, index: true },
    ts: { type: Date, required: true, index: true },
    actor: { type: String, default: null },
    action: { type: String, required: true },
    details: { type: mongoose.Schema.Types.Mixed, default: null },
    hash: { type: String, required: true },
    prevHash: { type: String, required: true }
  },
  { versionKey: false }
)

export const AuditEvent = mongoose.models.AuditEvent || mongoose.model('AuditEvent', AuditEventSchema)
