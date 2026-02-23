import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { PDFDocument } from 'pdf-lib'
import fs from 'fs/promises'
import fsSync from 'fs' // Added for synchronous streams needed by CloudConvert
import path from 'path'
import CloudConvert from 'cloudconvert' // Added
import https from 'https' // Added

const app = express()
const PORT = 5000
const API_KEY='eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiIxIiwianRpIjoiOTc2MGZhYTMyMjQxZjczNDk0ZDFiZDNjODMwNGE2NGNjOGMxZDUwMDZkMjk1OWUyOTI3ZDk1YTYxMmI4MDAxZGQ1MWQ4YmFkYzk5YTkyMzgiLCJpYXQiOjE3NzE4NTM0NTEuNzg0NTcyLCJuYmYiOjE3NzE4NTM0NTEuNzg0NTczLCJleHAiOjQ5Mjc1MjcwNTEuNzc5MDQ4LCJzdWIiOiI3NDQyNzgwNCIsInNjb3BlcyI6WyJ1c2VyLnJlYWQiLCJ1c2VyLndyaXRlIiwidGFzay5yZWFkIiwidGFzay53cml0ZSIsIndlYmhvb2sucmVhZCIsIndlYmhvb2sud3JpdGUiLCJwcmVzZXQucmVhZCIsInByZXNldC53cml0ZSJdfQ.oXy5Gyn1DzLLENHtO6ejdOyUo75kOMfxPtYqeAebJqLDZ-61uPjbCqVVE1RF3U_6Bm_rPT3-o-5eM7wHw7fAS2ZQ0JbofGFGA1OLZdfveC2NQFM88m0kEUwywmGfTTZcuV3JcY-nN1loNTjgrxv_YhLh_mqXGjylzz0Nh-XSd60iwQH2TJDt8TLFLMRSd4S0Aj_eOSFJCei8bZQSOfla9mbZd4rsTGw2lt6C1vLilcDd2CA8aOvy8ZlS8BrtMVIgxMNYEPxZolSVRbbytpi4Lhg8bq57iDwcU5WB1VyaO9i9Rpip3ZfohbdavmLn7tmojM8Ees1pp1o6-AyCAUZNfOtXpBhor-FRKjpr6Bk3y-qv4VFryVHuj0nu7_cwgMMWlM7Q9fIqeDT8SfdzyUXqlcaahydSmZ4B8UJxWIzdMkdTCrClfs50MnOgoXHpu-wm6U6AFTvGh3PhyQBZon_N09Wt3plBWHMqm6KQwvDjJ-2BCqqXTK92OKD9EmfVhgpfzzQwfONmALzKC8MlOTox5SzLIJ9BbiqOEyj2e_O8jDu0-JlGXgOIIi3_JickivEQGIbWFMZ-SgIDEQvYi7TALBk41DkCqmkDrGKDffN97bm015CRxPdwnnw00uGJl5Bzwv9QmuiA4aZO7j8jxeVjvD1TVn1NXiHTEW7XepsvmYI'



// Middleware
app.use(cors())
app.use(express.json())

// Initialize CloudConvert (You need a free API key from cloudconvert.com)
const cloudConvert = new CloudConvert(API_KEY)

// Configure multer for file uploads (Your existing storage config)
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

// EXISTING: Multer strictly for PDFs
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

// NEW: Multer strictly for PPTs
const uploadPpt = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.ms-powerpoint', 
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ];
    if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(ppt|pptx)$/i)) {
      cb(null, true)
    } else {
      cb(new Error('Only PPT/PPTX files are allowed'))
    }
  }
})

// --- EXISTING ROUTES ---

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

// --- NEW ROUTE: Convert PPT to PDF ---

app.post('/api/convert-ppt-to-pdf', uploadPpt.single('pptFile'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded or invalid file type.' });
  }

  try {
    console.log('PPT file received, starting conversion...');

    // 1. Create CloudConvert Job
    let job = await cloudConvert.jobs.create({
      tasks: {
        'import-file': { operation: 'import/upload' },
        'convert-file': {
          operation: 'convert',
          input: 'import-file',
          input_format: 'pptx',
          output_format: 'pdf'
        },
        'export-file': { operation: 'export/url', input: 'convert-file' }
      }
    });

    // 2. Upload file via Streams
    const uploadTask = job.tasks.find(task => task.name === 'import-file');
    const inputFile = fsSync.createReadStream(req.file.path);
    await cloudConvert.tasks.upload(uploadTask, inputFile, req.file.originalname);

    // 3. Wait for conversion
    job = await cloudConvert.jobs.wait(job.id);

    // 4. Stream PDF back to frontend
    const exportTask = job.tasks.find(task => task.name === 'export-file');
    const fileUrl = exportTask.result.files[0].url;

    https.get(fileUrl, (response) => {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${req.file.originalname.replace(/\.pptx?$/, '.pdf')}"`);
      response.pipe(res);
      
      // Cleanup Original File
      fsSync.unlinkSync(req.file.path);
    });

  } catch (error) {
    console.error('Conversion Error:', error);
    res.status(500).json({ error: 'Failed to convert file.' });
    if (fsSync.existsSync(req.file.path)) fsSync.unlinkSync(req.file.path);
  }
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})