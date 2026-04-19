import mongoose from 'mongoose'

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: false }, // optional if someone used old login
    passwordHash: { type: String, required: true },
    roles: { type: [String], default: [] }
  },
  { timestamps: true }
)

export const User = mongoose.models.User || mongoose.model('User', UserSchema)
