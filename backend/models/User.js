import mongoose from 'mongoose'

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    roles: { type: [String], default: [] }
  },
  { timestamps: true }
)

export const User = mongoose.models.User || mongoose.model('User', UserSchema)
