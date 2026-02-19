import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { PDFDocument } from 'pdf-lib'
import fs from 'fs/promises'
import path from 'path'

const app = express()
const PORT = 5000

// Middleware
app.use(cors())
app.use(express.json())

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = './uploads'
    try {
      await fs.mkdir(uploadDir, { recursive: true })
    } catch (err) {
      console.error('Error creating uploads directory:', err)
    }
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname)
  }
})

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true)
    } else {
      cb(new Error('Only PDF files are allowed'))
    }
  }
})

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'PDF Editor Backend API' })
})

// Upload PDF
app.post('/api/upload', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }
    
    res.json({
      message: 'File uploaded successfully',
      filename: req.file.filename,
      path: req.file.path
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get PDF info
app.get('/api/pdf/:filename', async (req, res) => {
  try {
    const filePath = path.join('./uploads', req.params.filename)
    const pdfBytes = await fs.readFile(filePath)
    const pdfDoc = await PDFDocument.load(pdfBytes)
    
    res.json({
      pages: pdfDoc.getPageCount(),
      title: pdfDoc.getTitle() || 'Untitled'
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Delete uploaded file
app.delete('/api/pdf/:filename', async (req, res) => {
  try {
    const filePath = path.join('./uploads', req.params.filename)
    await fs.unlink(filePath)
    res.json({ message: 'File deleted successfully' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
