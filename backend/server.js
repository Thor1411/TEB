import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { PDFDocument } from 'pdf-lib'
import fs from 'fs/promises'
import path from 'path'
import archiver from 'archiver'
import { exec } from 'child_process'
import { promisify } from 'util'
import sharp from 'sharp'

const execPromise = promisify(exec)

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

// Multer config for conversion features (accepts PDFs and images)
const conversionUpload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Only PDF and image files are allowed'))
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

// PDF to Images conversion
app.post('/api/pdf-to-images', conversionUpload.single('pdf'), async (req, res) => {
  let tempFiles = []
  let outputDir = null
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' })
    }

    const pdfPath = req.file.path
    tempFiles.push(pdfPath)
    
    // Create temporary output directory
    outputDir = path.join('./uploads', `temp-${Date.now()}`)
    await fs.mkdir(outputDir, { recursive: true })
    
    // Use pdftoppm (part of poppler-utils) to convert PDF to PNG images
    const outputPrefix = path.join(outputDir, 'page')
    const command = `pdftoppm -png "${pdfPath}" "${outputPrefix}"`
    
    await execPromise(command)

    // Read generated image files
    const files = await fs.readdir(outputDir)
    const imageFiles = files.filter(f => f.endsWith('.png')).sort()

    if (imageFiles.length === 0) {
      throw new Error('No images were generated from the PDF')
    }

    // Create a zip file
    const archive = archiver('zip', { zlib: { level: 9 } })
    
    res.attachment('images.zip')
    res.setHeader('Content-Type', 'application/zip')
    
    archive.pipe(res)

    // Add each image to the zip
    for (let i = 0; i < imageFiles.length; i++) {
      const imagePath = path.join(outputDir, imageFiles[i])
      const imageBuffer = await fs.readFile(imagePath)
      const filename = `page-${i + 1}.png`
      archive.append(imageBuffer, { name: filename })
    }

    await archive.finalize()

    // Clean up files after a delay
    setTimeout(async () => {
      try {
        // Delete all files in output directory
        if (outputDir) {
          const files = await fs.readdir(outputDir)
          for (const file of files) {
            await fs.unlink(path.join(outputDir, file))
          }
          await fs.rmdir(outputDir)
        }
        
        // Delete uploaded PDF
        for (const file of tempFiles) {
          await fs.unlink(file)
        }
      } catch (err) {
        console.error('Error deleting temp files:', err)
      }
    }, 2000)

  } catch (error) {
    console.error('Error converting PDF to images:', error)
    
    // Clean up files on error
    try {
      if (outputDir) {
        const files = await fs.readdir(outputDir).catch(() => [])
        for (const file of files) {
          await fs.unlink(path.join(outputDir, file)).catch(() => {})
        }
        await fs.rmdir(outputDir).catch(() => {})
      }
      
      for (const file of tempFiles) {
        await fs.unlink(file).catch(() => {})
      }
    } catch (cleanupErr) {
      console.error('Error during cleanup:', cleanupErr)
    }
    
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to convert PDF to images: ' + error.message })
    }
  }
})

// Images to PDF conversion
app.post('/api/images-to-pdf', conversionUpload.array('images', 50), async (req, res) => {
  let tempFiles = []
  
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No image files uploaded' })
    }

    tempFiles = req.files.map(f => f.path)

    // Create a new PDF document
    const pdfDoc = await PDFDocument.create()

    // Add each image to the PDF
    for (const file of req.files) {
      try {
        // Use sharp to read and normalize the image
        const imageBuffer = await sharp(file.path)
          .toFormat('png')
          .toBuffer()
        
        // Embed the normalized PNG image
        const image = await pdfDoc.embedPng(imageBuffer)
        const { width, height } = image
        
        // Create a page with the same dimensions as the image
        const page = pdfDoc.addPage([width, height])
        
        // Draw the image to fill the entire page
        page.drawImage(image, {
          x: 0,
          y: 0,
          width: width,
          height: height,
        })
      } catch (imageError) {
        console.error(`Error processing image ${file.originalname}:`, imageError)
        // Continue with other images instead of failing completely
      }
    }

    // Check if any pages were added
    if (pdfDoc.getPageCount() === 0) {
      throw new Error('No valid images could be processed')
    }

    // Save the PDF
    const pdfBytes = await pdfDoc.save()

    // Send the PDF
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename=converted.pdf')
    res.send(Buffer.from(pdfBytes))

    // Clean up uploaded image files after sending
    setTimeout(async () => {
      for (const file of tempFiles) {
        try {
          await fs.unlink(file)
        } catch (err) {
          console.error('Error deleting temp file:', err)
        }
      }
    }, 1000)

  } catch (error) {
    console.error('Error converting images to PDF:', error)
    
    // Clean up files on error
    for (const file of tempFiles) {
      try {
        await fs.unlink(file)
      } catch (err) {
        console.error('Error deleting temp file:', err)
      }
    }
    
    res.status(500).json({ error: 'Failed to convert images to PDF: ' + error.message })
  }
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
