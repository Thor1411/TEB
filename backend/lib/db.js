import mongoose from 'mongoose'

export const connectDb = async () => {
  const uri = process.env.MONGODB_URI || ''
  if (!uri) {
    // MongoDB is optional for local dev; platform falls back to in-memory user and filesystem metadata.
    return { enabled: false }
  }

  mongoose.set('strictQuery', true)
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: Number(process.env.MONGODB_TIMEOUT_MS || 5000)
  })

  return { enabled: true, uri }
}
