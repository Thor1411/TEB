import { useMemo, useState, useRef, useEffect } from 'react'
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import axios from 'axios'
import PDFViewer from './PDFViewer'
import Toolbar from './Toolbar'
import './PDFEditor.css'

function PDFEditor({ token, onLogout, currentUser }) {
  const [pdfFile, setPdfFile] = useState(null)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [recentDocs, setRecentDocs] = useState([])
  const profileMenuRef = useRef(null)
  
  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setShowProfileMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const [pdfDoc, setPdfDoc] = useState(null)
  const [docId, setDocId] = useState(null)
  const [embeddedSigning, setEmbeddedSigning] = useState(false)
  const [uploadingPdf, setUploadingPdf] = useState(false)
  const [loadingPdf, setLoadingPdf] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [gitEnabled, setGitEnabled] = useState(false)
  const [gitSignatureOk, setGitSignatureOk] = useState(null)
  const [editMode, setEditMode] = useState(null)
  const [textContent, setTextContent] = useState('')
  const [fontSize, setFontSize] = useState(16)
  // Use a stable "font key" (mapped to CSS + PDF fonts)
  const [fontFamily, setFontFamily] = useState('helvetica')
  const [textBoxes, setTextBoxes] = useState([]) // Active text boxes on canvas
  const [imageBoxes, setImageBoxes] = useState([]) // Active image boxes on canvas
  const [textSelections, setTextSelections] = useState([]) // Text selections for highlighting
  const [rectangleBoxes, setRectangleBoxes] = useState([]) // Editable rectangle overlays
  const [circleBoxes, setCircleBoxes] = useState([]) // Editable circle/ellipse overlays
  const [lineBoxes, setLineBoxes] = useState([]) // Editable line overlays
  const [undoStack, setUndoStack] = useState([])
  const fileInputRef = useRef(null)
  const [selectedTextId, setSelectedTextId] = useState(null)
  const [selectedRectangleId, setSelectedRectangleId] = useState(null)
  const [selectedCircleId, setSelectedCircleId] = useState(null)
  const [selectedLineId, setSelectedLineId] = useState(null)
  const imageInputRef = useRef(null)
  const [autoFocusTextBoxId, setAutoFocusTextBoxId] = useState(null)
  const fontBytesCacheRef = useRef(new Map())
  
  // Conversion feature states
  const [convertPdfFile, setConvertPdfFile] = useState(null)
  const [convertImageFiles, setConvertImageFiles] = useState([])
  const [mergePdfFiles, setMergePdfFiles] = useState([])
  const [pptFile, setPptFile] = useState(null)
  const [converting, setConverting] = useState(false)
  const convertPdfInputRef = useRef(null)
  const convertImageInputRef = useRef(null)
  const mergePdfInputRef = useRef(null)
  const pptInputRef = useRef(null)

  const api = useMemo(() => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'
    return axios.create({
      baseURL: `${API_URL}/api`,
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
  }, [token])

  const fetchRecentDocs = async () => {
    try {
      const res = await api.get('/documents')
      const docs = res.data.documents || []
      
      // Removed the grouping by name so all edits to the same or different files 
      // are visible, limited to the 5 most recent items. They are ordered by recently updated by the backend.
      setRecentDocs(docs.slice(0, 5))
    } catch (e) {
      console.error('Failed to fetch recent docs', e)
    }
  }

  useEffect(() => {
    fetchRecentDocs()
  }, [token])

  useEffect(() => {
    const id = api.interceptors.response.use(
      (resp) => resp,
      (err) => {
        const status = err?.response?.status
        if (status === 401) {
          alert('Session expired or invalid. Please login again.')
          if (onLogout) onLogout()
        }
        return Promise.reject(err)
      }
    )
    return () => api.interceptors.response.eject(id)
  }, [api, onLogout])

  // Load document from URL param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const docIdParam = params.get('doc')
    if (docIdParam && !pdfFile) {
      const loadDoc = async () => {
        try {
          setLoadingPdf(true)
          const downloadRes = await api.get(`/documents/${docIdParam}/download`, { responseType: 'arraybuffer' })
          const bytes = downloadRes.data
          const blob = new Blob([bytes], { type: 'application/pdf' })
          const arrayBuffer = await blob.arrayBuffer()
          const pdf = await PDFDocument.load(arrayBuffer)

          setDocId(docIdParam)
          setPdfDoc(pdf)
          const newUrl = URL.createObjectURL(blob)
          setPdfFile(newUrl)
          setTotalPages(pdf.getPageCount())
          setCurrentPage(1)
        } catch (err) {
          console.error(err)
          alert('Failed to load document. Note: Only the document creator can view this PDF.')
        } finally {
          setLoadingPdf(false)
        }
      }
      loadDoc()
    }
  }, [api, pdfFile])

  // Fetch embedded PDF Git status for the current doc
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!docId) {
        setGitEnabled(false)
        setGitSignatureOk(null)
        return
      }
      try {
        const res = await api.get(`/documents/${docId}/git`)
        if (cancelled) return
        const enabled = !!res.data?.enabled
        setGitEnabled(enabled)
        if (!enabled) {
          setGitSignatureOk(null)
        } else {
          const sigOk = res.data?.signature?.ok
          setGitSignatureOk(typeof sigOk === 'boolean' ? sigOk : null)
        }
      } catch {
        if (cancelled) return
        setGitEnabled(false)
        setGitSignatureOk(null)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [api, docId])

  // Deselect overlays when clicking outside boxes + toolbars
  useEffect(() => {
    if (
      selectedTextId == null &&
      selectedRectangleId == null &&
      selectedCircleId == null &&
      selectedLineId == null
    ) {
      return
    }

    const handleGlobalMouseDown = (e) => {
      const el = e.target instanceof Element ? e.target : e.target?.parentElement
      if (!el) return

      // Keep selection when interacting with text boxes or toolbars
      if (
        el.closest('.text-box') ||
        el.closest('.rect-box') ||
        el.closest('.circle-box') ||
        el.closest('.line-box') ||
        el.closest('.secondary-toolbar') ||
        el.closest('.toolbar')
      ) {
        return
      }

      setSelectedTextId(null)
      setSelectedRectangleId(null)
      setSelectedCircleId(null)
      setSelectedLineId(null)
    }

    document.addEventListener('mousedown', handleGlobalMouseDown)
    return () => document.removeEventListener('mousedown', handleGlobalMouseDown)
  }, [selectedTextId, selectedRectangleId, selectedCircleId, selectedLineId])

  const handleFileUpload = async (event) => {
    const file = event.target.files[0]
    try {
      const name = String(file?.name || '').toLowerCase()
      const type = String(file?.type || '').toLowerCase()
      const looksLikePdf = name.endsWith('.pdf') || type.includes('pdf')
      if (!file || !looksLikePdf) {
        alert('Please upload a valid PDF file')
        return
      }

      setUploadingPdf(true)

      // Secure workflow: upload to backend (sanitize + encrypt at rest), then download sanitized PDF for editing.
      const formData = new FormData()
      formData.append('pdf', file)
      const createRes = await api.post('/documents', formData)

      const id = createRes.data?.id
      if (!id) throw new Error('Upload failed: missing document id')

      const downloadRes = await api.get(`/documents/${id}/download`, { responseType: 'arraybuffer' })
      const bytes = downloadRes.data
      const blob = new Blob([bytes], { type: 'application/pdf' })

      const arrayBuffer = await blob.arrayBuffer()
      const pdf = await PDFDocument.load(arrayBuffer)
      setPdfDoc(pdf)
      const oldUrl = pdfFile
      const newUrl = URL.createObjectURL(blob)
      setPdfFile(newUrl)
      if (oldUrl) setTimeout(() => URL.revokeObjectURL(oldUrl), 100)

      setDocId(id)
      setTotalPages(pdf.getPageCount())
      setCurrentPage(1)
      setGitEnabled(false)
      setGitSignatureOk(null)
      setUndoStack([])
      setTextBoxes([])
      setImageBoxes([])
      setTextSelections([])
      setRectangleBoxes([])
      setCircleBoxes([])
      setLineBoxes([])
      setEditMode(null)
      setSelectedTextId(null)
      setSelectedRectangleId(null)
      setSelectedCircleId(null)
      setSelectedLineId(null)
      fetchRecentDocs()
    } catch (e) {
      console.error(e)
      alert(e?.response?.data?.error || e.message || 'Failed to upload PDF')
    } finally {
      setUploadingPdf(false)
      // Reset input so re-uploading same file triggers change
      event.target.value = ''
    }
  }

  const handleGitInit = async () => {
    try {
      if (!docId) {
        alert('No document loaded')
        return
      }
      const res = await api.post(`/documents/${docId}/git/init`)
      const newId = res.data?.id
      if (!newId) throw new Error('Init failed')

      const downloadRes = await api.get(`/documents/${newId}/download`, { responseType: 'arraybuffer' })
      const bytes = downloadRes.data
      const blob = new Blob([bytes], { type: 'application/pdf' })
      const arrayBuffer = await blob.arrayBuffer()
      const pdf = await PDFDocument.load(arrayBuffer)

      setDocId(newId)
      setPdfDoc(pdf)
      const oldUrl = pdfFile
      const newUrl = URL.createObjectURL(blob)
      setPdfFile(newUrl)
      if (oldUrl) setTimeout(() => URL.revokeObjectURL(oldUrl), 100)

      setTotalPages(pdf.getPageCount())
      setCurrentPage(1)
      setUndoStack([])
      setTextBoxes([])
      setImageBoxes([])
      setTextSelections([])
      setRectangleBoxes([])
      setCircleBoxes([])
      setLineBoxes([])
      setEditMode(null)
      setSelectedTextId(null)
      setSelectedRectangleId(null)
      setSelectedCircleId(null)
      setSelectedLineId(null)
      alert('PDF Git initialized and embedded into the PDF')
    } catch (e) {
      console.error(e)
      alert(e?.response?.data?.error || e.message || 'Failed to initialize PDF Git')
    }
  }

  const formatGitHistory = (git) => {
    if (!git?.head || !git?.commits) return 'No history'
    const lines = []
    const headShort = String(git.head).slice(0, 8)
    lines.push(`Repo: ${git.repoId || 'unknown'}`)
    lines.push(`HEAD -> main (${headShort})`)
    lines.push('')

    const seen = new Set()
    let cur = git.head
    let n = 0
    while (cur && git.commits[cur] && !seen.has(cur) && n < 30) {
      seen.add(cur)
      const c = git.commits[cur]
      const actor = c.actor?.email || c.actor?.id || 'unknown'
      const short = String(c.id || cur).slice(0, 8)
      lines.push(`o ${short}  ${c.message}`)
      lines.push(`|  ${c.ts}  by ${actor}`)
      if (Array.isArray(c.actions) && c.actions.length > 0) {
        for (const a of c.actions.slice(0, 8)) {
          const page = a.page ? ` page=${a.page}` : ''
          const txt = a.text ? ` text=${JSON.stringify(String(a.text).slice(0, 80))}` : ''
          lines.push(`|  - ${a.type}${page}${txt}`)
        }
        if (c.actions.length > 8) lines.push('  - ...')
      }
      lines.push('|')
      cur = c.parent
      n++
    }
    return lines.join('\n')
  }

  const handleGitHistory = async (historyWindow) => {
    if (!docId) {
      alert('No document loaded')
      return
    }

    // Prefer a window opened synchronously by the click handler.
    const w = historyWindow || window.open('', '_blank', 'noopener,noreferrer')
    if (!w) return

    const writePage = ({ title, subtitle, body }) => {
      const safeTitle = String(title || 'PDF Git').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      const safeSubtitle = String(subtitle || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      const safeBody = String(body || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')

      w.document.open()
      w.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
    <style>
      :root { color-scheme: light dark; }
      body { margin: 0; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
      header { padding: 16px 18px; border-bottom: 1px solid rgba(127,127,127,0.25); }
      h1 { margin: 0; font-size: 18px; }
      .sub { margin-top: 6px; opacity: 0.8; font-size: 13px; }
      main { padding: 16px 18px; }
      pre { white-space: pre-wrap; word-break: break-word; line-height: 1.35; font-size: 13px; }
      .hint { opacity: 0.75; font-size: 12px; margin-top: 12px; }
    </style>
  </head>
  <body>
    <header>
      <h1>${safeTitle}</h1>
      ${safeSubtitle ? `<div class="sub">${safeSubtitle}</div>` : ''}
    </header>
    <main>
      <pre>${safeBody}</pre>
      <div class="hint">This view is generated by TEB from embedded PDF metadata.</div>
    </main>
  </body>
</html>`)
      w.document.close()
    }

    writePage({
      title: 'PDF Git — History tree',
      subtitle: `Document: ${docId}`,
      body: 'Loading…'
    })

    try {
      const res = await api.get(`/documents/${docId}/git`)
      if (!res.data?.enabled) {
        writePage({
          title: 'PDF Git — History tree',
          subtitle: `Document: ${docId}`,
          body: 'PDF Git is not initialized for this PDF.'
        })
        return
      }

      const sig = res.data?.signature
      const sigLine = typeof sig?.ok === 'boolean'
        ? `Signature: ${sig.ok ? 'OK' : 'FAIL'}${sig.error ? ` (${sig.error})` : ''}`
        : 'Signature: unknown'

      writePage({
        title: 'PDF Git — History tree',
        subtitle: `${sigLine}`,
        body: formatGitHistory(res.data.git)
      })
    } catch (e) {
      console.error(e)
      writePage({
        title: 'PDF Git — History tree',
        subtitle: `Document: ${docId}`,
        body: e?.response?.data?.error || e.message || 'Failed to load PDF Git history'
      })
    }
  }

  const handleGitVerify = async () => {
    try {
      if (!docId) {
        alert('No document loaded')
        return
      }
      const res = await api.get(`/documents/${docId}/git/verify`)
      const ok = !!res.data?.ok
      const modified = Array.isArray(res.data?.modifiedPages) ? res.data.modifiedPages : []
      const sigOk = res.data?.signature?.ok
      const sigMsg = typeof sigOk === 'boolean' ? `Signature: ${sigOk ? 'OK' : 'FAIL'}` : 'Signature: unknown'
      if (ok) {
        alert(`PDF Git verification OK\n${sigMsg}`)
      } else {
        alert(`PDF was modified outside authorized flow\nModified pages: ${modified.join(', ') || 'unknown'}\n${sigMsg}`)
      }
    } catch (e) {
      console.error(e)
      alert(e?.response?.data?.error || e.message || 'Verification failed')
    }
  }

  // Handle clicking on PDF to add text box
  const handleAddTextBox = (coords) => {
    if (editMode !== 'text') return

    const pdfScaleFactor = typeof coords.pdfScaleFactor === 'number' && Number.isFinite(coords.pdfScaleFactor)
      ? coords.pdfScaleFactor
      : (1 / 1.5)

    const pdfFontSize = fontSize * pdfScaleFactor

    const newTextBox = {
      id: Date.now(),
      text: '', // Empty initially - user types directly in the box
      displayX: coords.displayX, // For CSS positioning
      displayY: coords.displayY,
      pdfX: coords.pdfX, // For PDF drawing
      pdfY: coords.pdfY,
      fontSize: fontSize,
      pdfFontSize,
      pdfScaleFactor,
      fontFamily: fontFamily,
      fontWeight: 'normal',
      fontStyle: 'normal',
      color: '#000000',
      page: currentPage
    }

    setTextBoxes(prev => [...prev, newTextBox])
    setSelectedTextId(newTextBox.id)
    setAutoFocusTextBoxId(newTextBox.id)

    // Return cursor to normal after placing one text box
    setEditMode(null)
  }

  // Update text box position when dragged
  const handleUpdateTextBox = (id, updates) => {
    setTextBoxes(textBoxes.map(box => {
      if (box.id === id) {
        // If updating position, only update display coordinates
        // PDF coordinates will be recalculated when applying
        if (updates.displayX !== undefined || updates.displayY !== undefined) {
          return { ...box, ...updates }
        }
        // For text content updates
        return { ...box, ...updates }
      }
      return box
    }))
  }

  // Remove a text box
  const handleRemoveTextBox = (id) => {
    setTextBoxes(textBoxes.filter(box => box.id !== id))
  }

  // Handle image upload
  const handleImageUpload = (event) => {
    const file = event.target.files[0]
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          // Create image box with default size and position
          const defaultWidth = Math.min(img.width, 300)
          const defaultHeight = Math.min(img.height, 300)
          
          const imageBox = {
            id: Date.now(),
            imageData: e.target.result,
            displayX: 100, // Display coordinates for overlay
            displayY: 100,
            pdfX: 100, // PDF coordinates for embedding (will be adjusted)
            pdfY: 100,
            pdfWidth: null,
            pdfHeight: null,
            width: defaultWidth,
            height: defaultHeight,
            originalWidth: img.width,
            originalHeight: img.height,
            page: currentPage,
            fileType: file.type
          }
          setImageBoxes([...imageBoxes, imageBox])
          setEditMode('image')
        }
        img.src = e.target.result
      }
      reader.readAsDataURL(file)
    } else {
      alert('Please select a valid image file (PNG, JPG, etc.)')
    }
    // Reset input
    event.target.value = ''
  }

  // Update image box position or size
  const handleUpdateImageBox = (id, updates) => {
    setImageBoxes(imageBoxes.map(box => 
      box.id === id ? { ...box, ...updates } : box
    ))
  }

  // Remove an image box
  const handleRemoveImageBox = (id) => {
    setImageBoxes(imageBoxes.filter(box => box.id !== id))
  }

  // Apply images to PDF
  const handleApplyImages = async () => {
    if (imageBoxes.length === 0) {
      alert('No images to apply')
      return
    }

    await saveToUndoStack()

    const pages = pdfDoc.getPages()

    // Group images by page
    const imagesByPage = {}
    imageBoxes.forEach(box => {
      if (!imagesByPage[box.page]) {
        imagesByPage[box.page] = []
      }
      imagesByPage[box.page].push(box)
    })

    // Add images to each page
    for (const [pageNum, images] of Object.entries(imagesByPage)) {
      const page = pages[parseInt(pageNum) - 1]
      const { height: pageHeight } = page.getSize()

      for (const imgBox of images) {
        try {
          // Convert base64 to bytes
          const base64Data = imgBox.imageData.split(',')[1]
          const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))

          // Embed image based on type
          let pdfImage
          if (imgBox.fileType === 'image/png') {
            pdfImage = await pdfDoc.embedPng(imageBytes)
          } else if (imgBox.fileType === 'image/jpeg' || imgBox.fileType === 'image/jpg') {
            pdfImage = await pdfDoc.embedJpg(imageBytes)
          } else {
            // Try PNG first, fallback to JPG
            try {
              pdfImage = await pdfDoc.embedPng(imageBytes)
            } catch {
              pdfImage = await pdfDoc.embedJpg(imageBytes)
            }
          }

          // Use PDF coordinates for embedding
          const pdfY = pageHeight - imgBox.pdfY - imgBox.height

          page.drawImage(pdfImage, {
            x: imgBox.pdfX,
            y: pdfY,
            width: imgBox.width,
            height: imgBox.height
          })
        } catch (error) {
          console.error('Error embedding image:', error)
          alert(`Failed to embed image. Error: ${error.message}`)
        }
      }
    }

    await refreshPDF()
    setImageBoxes([])
    setEditMode(null)
  }

  // Handle text selection for highlighting
  const handleTextSelection = (selection) => {
    if (editMode !== 'highlight-select') return
    
    // Add to text selections
    setTextSelections([...textSelections, {
      ...selection,
      id: Date.now(),
      page: currentPage
    }])
  }

  // Apply text selection highlights to PDF
  const handleApplyHighlights = async () => {
    if (textSelections.length === 0) {
      alert('No text selections to highlight')
      return
    }

    await saveToUndoStack()

    const pages = pdfDoc.getPages()

    // Group selections by page
    const selectionsByPage = {}
    textSelections.forEach(sel => {
      if (!selectionsByPage[sel.page]) {
        selectionsByPage[sel.page] = []
      }
      selectionsByPage[sel.page].push(sel)
    })

    // Add highlights to each page
    for (const [pageNum, selections] of Object.entries(selectionsByPage)) {
      const page = pages[parseInt(pageNum) - 1]
      const { height: pageHeight } = page.getSize()

      selections.forEach(sel => {
        sel.rects.forEach(rect => {
          const pdfY = pageHeight - rect.y - rect.height
          page.drawRectangle({
            x: rect.x,
            y: pdfY,
            width: rect.width,
            height: rect.height,
            color: rgb(1, 1, 0),
            opacity: 0.3
          })
        })
      })
    }

    await refreshPDF()
    setTextSelections([])
    setEditMode(null)
  }

  // Remove a text selection
  const handleRemoveSelection = (id) => {
    setTextSelections(textSelections.filter(sel => sel.id !== id))
  }

  // Apply text boxes to PDF
  // const handleApplyText = async () => {
  //   // Filter out empty text boxes
  //   const validBoxes = textBoxes.filter(box => box.text.trim())
    
  //   if (validBoxes.length === 0) {
  //     alert('Please add some text to the text boxes')
  //     return
  //   }

  //   await saveToUndoStack()

  //   const pages = pdfDoc.getPages()
  //   const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

  //   // Group text boxes by page
  //   const boxesByPage = {}
  //   validBoxes.forEach(box => {
  //     if (!boxesByPage[box.page]) {
  //       boxesByPage[box.page] = []
  //     }
  //     boxesByPage[box.page].push(box)
  //   })

  //   // Add text to each page
  //   for (const [pageNum, boxes] of Object.entries(boxesByPage)) {
  //     const page = pages[parseInt(pageNum) - 1]
  //     const { height: pageHeight } = page.getSize()

  //     boxes.forEach(box => {
  //       // Use PDF coordinates that were calculated when placing the text box
  //       const pdfY = pageHeight - box.pdfY - box.fontSize
  //       page.drawText(box.text, {
  //         x: box.pdfX,
  //         y: pdfY,
  //         size: box.fontSize,
  //         font: font,
  //         color: rgb(0, 0, 0)
  //       })
  //     })
  //   }

  //   await refreshPDF()
  //   setTextBoxes([])
  //   setEditMode(null)
  // }

  const getFontBytes = async (url) => {
    if (!url) return null
    const cache = fontBytesCacheRef.current
    if (cache.has(url)) return cache.get(url)

    const res = await fetch(url)
    if (!res.ok) {
      throw new Error(`Failed to load font: ${url}`)
    }
    const buf = await res.arrayBuffer()
    const bytes = new Uint8Array(buf)
    cache.set(url, bytes)
    return bytes
  }

  const getCustomFontUrl = (fontKey) => {
    switch (fontKey) {
      case 'inter':
        return '/fonts/Inter.ttf'
      case 'lato':
        return '/fonts/Lato-Regular.ttf'
      case 'poppins':
        return '/fonts/Poppins-Regular.ttf'
      case 'oswald':
        return '/fonts/Oswald.ttf'
      case 'roboto-condensed':
        return '/fonts/RobotoCondensed-Regular.ttf'
      default:
        return null
    }
  }

  const parseHexColorToRgb = (hex) => {
    if (typeof hex !== 'string') return rgb(0, 0, 0)
    const raw = hex.trim()
    if (!raw.startsWith('#')) return rgb(0, 0, 0)
    const h = raw.slice(1)
    let r, g, b
    if (h.length === 3) {
      r = parseInt(h[0] + h[0], 16)
      g = parseInt(h[1] + h[1], 16)
      b = parseInt(h[2] + h[2], 16)
    } else if (h.length === 6) {
      r = parseInt(h.slice(0, 2), 16)
      g = parseInt(h.slice(2, 4), 16)
      b = parseInt(h.slice(4, 6), 16)
    } else {
      return rgb(0, 0, 0)
    }

    if (![r, g, b].every(n => Number.isFinite(n))) return rgb(0, 0, 0)
    return rgb(r / 255, g / 255, b / 255)
  }

  const getStandardFontName = (fontKey, isBold, isItalic) => {
    if (fontKey === 'helvetica') {
      if (isBold && isItalic) return StandardFonts.HelveticaBoldOblique
      if (isBold) return StandardFonts.HelveticaBold
      if (isItalic) return StandardFonts.HelveticaOblique
      return StandardFonts.Helvetica
    }

    if (fontKey === 'times') {
      if (isBold && isItalic) return StandardFonts.TimesRomanBoldItalic
      if (isBold) return StandardFonts.TimesRomanBold
      if (isItalic) return StandardFonts.TimesRomanItalic
      return StandardFonts.TimesRoman
    }

    if (fontKey === 'courier') {
      if (isBold && isItalic) return StandardFonts.CourierBoldOblique
      if (isBold) return StandardFonts.CourierBold
      if (isItalic) return StandardFonts.CourierOblique
      return StandardFonts.Courier
    }

    return StandardFonts.Helvetica
  }

  const normalizeFontKey = (value) => {
    if (!value) return 'helvetica'

    // Already normalized
    if (
      value === 'helvetica' ||
      value === 'times' ||
      value === 'courier' ||
      value === 'roboto-condensed' ||
      value === 'oswald' ||
      value === 'inter' ||
      value === 'poppins' ||
      value === 'lato'
    ) {
      return value
    }

    // Legacy / display values
    if (value === 'Helvetica') return 'helvetica'
    if (value === 'TimesRoman' || value === 'Times') return 'times'
    if (value === 'Courier') return 'courier'
    if (value === 'Roboto Condensed' || value === 'RobotoCondensed') return 'roboto-condensed'
    if (value === 'Oswald') return 'oswald'
    if (value === 'Inter') return 'inter'
    if (value === 'Poppins') return 'poppins'
    if (value === 'Lato') return 'lato'

    return 'helvetica'
  }

  const applyTextBoxesToPdf = async (doc, boxesToApply) => {
    if (!doc || !boxesToApply || boxesToApply.length === 0) return

    const pages = doc.getPages()
    const embeddedFontCache = new Map()
    const fontkitInstance = fontkit?.default ?? fontkit

    // Group text boxes by page
    const boxesByPage = {}
    boxesToApply.forEach(box => {
      if (!boxesByPage[box.page]) {
        boxesByPage[box.page] = []
      }
      boxesByPage[box.page].push(box)
    })

    for (const [pageNum, boxes] of Object.entries(boxesByPage)) {
      const page = pages[parseInt(pageNum) - 1]
      const { height } = page.getSize()

      for (const box of boxes) {
        let font
        const fontKey = normalizeFontKey(box.fontFamily)
        const isBold = (box.fontWeight ?? 'normal') === 'bold' || box.isBold === true
        const isItalic = (box.fontStyle ?? 'normal') === 'italic' || box.isItalic === true

        const isStandard = fontKey === 'helvetica' || fontKey === 'times' || fontKey === 'courier'
        const fontCacheKey = isStandard
          ? `${fontKey}:${isBold ? 'b' : ''}${isItalic ? 'i' : ''}`
          : fontKey

        if (embeddedFontCache.has(fontCacheKey)) {
          font = embeddedFontCache.get(fontCacheKey)
        } else {
          if (isStandard) {
            const stdFontName = getStandardFontName(fontKey, isBold, isItalic)
            font = await doc.embedFont(stdFontName)
          } else {
            // Embed a real TTF for export so the downloaded PDF matches the editor.
            // Bold/italic for custom fonts is handled via a simple PDF fallback (see below).
            const fontUrl = getCustomFontUrl(fontKey)
            if (!fontUrl || !fontkitInstance) {
              font = await doc.embedFont(StandardFonts.Helvetica)
            } else {
              try {
                doc.registerFontkit(fontkitInstance)
                const fontBytes = await getFontBytes(fontUrl)
                font = await doc.embedFont(fontBytes, { subset: true })
              } catch {
                font = await doc.embedFont(StandardFonts.Helvetica)
              }
            }
          }
          embeddedFontCache.set(fontCacheKey, font)
        }

        const pdfFontSize = typeof box.pdfFontSize === 'number' && Number.isFinite(box.pdfFontSize)
          ? box.pdfFontSize
          : box.fontSize

        // Match on-screen positioning:
        // - The on-screen text starts *inside* the text box due to CSS padding.
        // - pdf-lib draws from the baseline, not from the top.
        const pdfScaleFactor = typeof box.pdfScaleFactor === 'number' && Number.isFinite(box.pdfScaleFactor)
          ? box.pdfScaleFactor
          : (1 / 1.5)

        const paddingLeftPx = 12
        const paddingTopPx = 8

        const pdfTextX = box.pdfX + (paddingLeftPx * pdfScaleFactor)
        const pdfTextTop = box.pdfY + (paddingTopPx * pdfScaleFactor)

        // Use ascent (exclude descender) to align top better.
        let ascentHeight = pdfFontSize
        if (typeof font?.heightAtSize === 'function') {
          try {
            ascentHeight = font.heightAtSize(pdfFontSize, { descender: false })
          } catch {
            ascentHeight = font.heightAtSize(pdfFontSize)
          }
        }

        const pdfY = height - pdfTextTop - ascentHeight

        const textColor = parseHexColorToRgb(box.color)

        const shouldFakeItalic = !isStandard && isItalic
        const shouldFakeBold = !isStandard && isBold

        const drawOptions = {
          x: pdfTextX,
          y: pdfY,
          size: pdfFontSize,
          font,
          color: textColor,
          ...(shouldFakeItalic ? { xSkew: degrees(12) } : {})
        }

        page.drawText(box.text, drawOptions)
        if (shouldFakeBold) {
          const boldOffset = Math.max(0.25, pdfFontSize * 0.03)
          page.drawText(box.text, {
            ...drawOptions,
            x: pdfTextX + boldOffset
          })
        }
      }
    }
  }

  const applyImageBoxesToPdf = async (doc, boxesToApply) => {
    if (!doc || !boxesToApply || boxesToApply.length === 0) return

    const pages = doc.getPages()

    // Group images by page
    const imagesByPage = {}
    boxesToApply.forEach(box => {
      if (!imagesByPage[box.page]) {
        imagesByPage[box.page] = []
      }
      imagesByPage[box.page].push(box)
    })

    for (const [pageNum, images] of Object.entries(imagesByPage)) {
      const page = pages[parseInt(pageNum) - 1]
      const { height: pageHeight } = page.getSize()

      for (const imgBox of images) {
        // Convert base64 to bytes
        const base64Data = imgBox.imageData.split(',')[1]
        const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))

        // Embed image based on type
        let pdfImage
        if (imgBox.fileType === 'image/png') {
          pdfImage = await doc.embedPng(imageBytes)
        } else if (imgBox.fileType === 'image/jpeg' || imgBox.fileType === 'image/jpg') {
          pdfImage = await doc.embedJpg(imageBytes)
        } else {
          // Try PNG first, fallback to JPG
          try {
            pdfImage = await doc.embedPng(imageBytes)
          } catch {
            pdfImage = await doc.embedJpg(imageBytes)
          }
        }

        const pdfWidth = typeof imgBox.pdfWidth === 'number' && Number.isFinite(imgBox.pdfWidth)
          ? imgBox.pdfWidth
          : imgBox.width

        const pdfHeight = typeof imgBox.pdfHeight === 'number' && Number.isFinite(imgBox.pdfHeight)
          ? imgBox.pdfHeight
          : imgBox.height

        const pdfY = pageHeight - imgBox.pdfY - pdfHeight
        page.drawImage(pdfImage, {
          x: imgBox.pdfX,
          y: pdfY,
          width: pdfWidth,
          height: pdfHeight
        })
      }
    }
  }

  const applyTextSelectionsToPdf = async (doc, selectionsToApply) => {
    if (!doc || !selectionsToApply || selectionsToApply.length === 0) return

    const pages = doc.getPages()

    // Group selections by page
    const selectionsByPage = {}
    selectionsToApply.forEach(sel => {
      if (!selectionsByPage[sel.page]) {
        selectionsByPage[sel.page] = []
      }
      selectionsByPage[sel.page].push(sel)
    })

    for (const [pageNum, selections] of Object.entries(selectionsByPage)) {
      const page = pages[parseInt(pageNum) - 1]
      const { height: pageHeight } = page.getSize()

      selections.forEach(sel => {
        sel.rects.forEach(rect => {
          const pdfY = pageHeight - rect.y - rect.height
          page.drawRectangle({
            x: rect.x,
            y: pdfY,
            width: rect.width,
            height: rect.height,
            color: rgb(1, 1, 0),
            opacity: 0.3
          })
        })
      })
    }
  }

  const applyRectangleBoxesToPdf = async (doc, boxesToApply) => {
    if (!doc || !boxesToApply || boxesToApply.length === 0) return

    const pages = doc.getPages()

    const byPage = {}
    boxesToApply.forEach(b => {
      if (!byPage[b.page]) byPage[b.page] = []
      byPage[b.page].push(b)
    })

    for (const [pageNum, boxes] of Object.entries(byPage)) {
      const page = pages[parseInt(pageNum) - 1]
      const { height: pageHeight } = page.getSize()

      for (const box of boxes) {
        const pdfWidth = typeof box.pdfWidth === 'number' && Number.isFinite(box.pdfWidth)
          ? box.pdfWidth
          : box.width
        const pdfHeight = typeof box.pdfHeight === 'number' && Number.isFinite(box.pdfHeight)
          ? box.pdfHeight
          : box.height

        const pdfY = pageHeight - box.pdfY - pdfHeight

        const strokeColor = parseHexColorToRgb(box.strokeColor)
        const fillColor = parseHexColorToRgb(box.fillColor)

        const pdfScaleFactor = typeof box.pdfScaleFactor === 'number' && Number.isFinite(box.pdfScaleFactor)
          ? box.pdfScaleFactor
          : (1 / 1.5)

        const strokeWidth = typeof box.strokeWidth === 'number' && Number.isFinite(box.strokeWidth)
          ? box.strokeWidth
          : 2

        const borderWidth = Math.max(0.25, strokeWidth * pdfScaleFactor)

        page.drawRectangle({
          x: box.pdfX,
          y: pdfY,
          width: pdfWidth,
          height: pdfHeight,
          ...(box.filled ? { color: fillColor } : {}),
          borderColor: strokeColor,
          borderWidth
        })
      }
    }
  }

  const applyCircleBoxesToPdf = async (doc, boxesToApply) => {
    if (!doc || !boxesToApply || boxesToApply.length === 0) return

    const pages = doc.getPages()

    const byPage = {}
    boxesToApply.forEach(b => {
      if (!byPage[b.page]) byPage[b.page] = []
      byPage[b.page].push(b)
    })

    for (const [pageNum, boxes] of Object.entries(byPage)) {
      const page = pages[parseInt(pageNum) - 1]
      const { height: pageHeight } = page.getSize()

      for (const box of boxes) {
        const pdfWidth = typeof box.pdfWidth === 'number' && Number.isFinite(box.pdfWidth)
          ? box.pdfWidth
          : box.width
        const pdfHeight = typeof box.pdfHeight === 'number' && Number.isFinite(box.pdfHeight)
          ? box.pdfHeight
          : box.height

        const centerX = box.pdfX + (pdfWidth / 2)
        const centerY = pageHeight - box.pdfY - (pdfHeight / 2)

        const strokeColor = parseHexColorToRgb(box.strokeColor)
        const fillColor = parseHexColorToRgb(box.fillColor)

        const pdfScaleFactor = typeof box.pdfScaleFactor === 'number' && Number.isFinite(box.pdfScaleFactor)
          ? box.pdfScaleFactor
          : (1 / 1.5)

        const strokeWidth = typeof box.strokeWidth === 'number' && Number.isFinite(box.strokeWidth)
          ? box.strokeWidth
          : 2

        const borderWidth = Math.max(0.25, strokeWidth * pdfScaleFactor)

        page.drawEllipse({
          x: centerX,
          y: centerY,
          xScale: pdfWidth / 2,
          yScale: pdfHeight / 2,
          ...(box.filled ? { color: fillColor } : {}),
          borderColor: strokeColor,
          borderWidth
        })
      }
    }
  }

  const applyLineBoxesToPdf = async (doc, boxesToApply) => {
    if (!doc || !boxesToApply || boxesToApply.length === 0) return

    const pages = doc.getPages()

    const byPage = {}
    boxesToApply.forEach(b => {
      if (!byPage[b.page]) byPage[b.page] = []
      byPage[b.page].push(b)
    })

    for (const [pageNum, boxes] of Object.entries(byPage)) {
      const page = pages[parseInt(pageNum) - 1]
      const { height: pageHeight } = page.getSize()

      for (const box of boxes) {
        const strokeColor = parseHexColorToRgb(box.strokeColor)

        const pdfScaleFactor = typeof box.pdfScaleFactor === 'number' && Number.isFinite(box.pdfScaleFactor)
          ? box.pdfScaleFactor
          : (1 / 1.5)

        const strokeWidth = typeof box.strokeWidth === 'number' && Number.isFinite(box.strokeWidth)
          ? box.strokeWidth
          : 2

        const thickness = Math.max(0.25, strokeWidth * pdfScaleFactor)

        // New format: endpoints stored directly.
        const hasEndpoints =
          typeof box.pdfX1 === 'number' && Number.isFinite(box.pdfX1) &&
          typeof box.pdfY1 === 'number' && Number.isFinite(box.pdfY1) &&
          typeof box.pdfX2 === 'number' && Number.isFinite(box.pdfX2) &&
          typeof box.pdfY2 === 'number' && Number.isFinite(box.pdfY2)

        let start
        let end
        if (hasEndpoints) {
          start = { x: box.pdfX1, y: pageHeight - box.pdfY1 }
          end = { x: box.pdfX2, y: pageHeight - box.pdfY2 }
        } else {
          // Back-compat: older format stored as bounding rect + direction flags
          const pdfWidth = typeof box.pdfWidth === 'number' && Number.isFinite(box.pdfWidth)
            ? box.pdfWidth
            : box.width
          const pdfHeight = typeof box.pdfHeight === 'number' && Number.isFinite(box.pdfHeight)
            ? box.pdfHeight
            : box.height

          const startOnRight = !!box.startOnRight
          const startOnBottom = !!box.startOnBottom

          const xLeft = box.pdfX
          const xRight = box.pdfX + pdfWidth
          const yTop = pageHeight - box.pdfY
          const yBottom = pageHeight - box.pdfY - pdfHeight

          start = {
            x: startOnRight ? xRight : xLeft,
            y: startOnBottom ? yBottom : yTop
          }

          end = {
            x: startOnRight ? xLeft : xRight,
            y: startOnBottom ? yTop : yBottom
          }
        }

        page.drawLine({
          start,
          end,
          thickness,
          color: strokeColor
        })
      }
    }
  }

  // "Apply" keeps text editable + draggable (Canva/PPT style).
  // Text is baked into the PDF only when downloading.
  const handleApplyText = async () => {
    const validBoxes = textBoxes.filter(box => box.text.trim())
    if (validBoxes.length === 0) {
      alert('Please add some text to the text boxes')
      return
    }

    setEditMode(null)
  }

  const updateSelectedTextBox = (updates) => {
    if (!selectedTextId) return

    setTextBoxes(prev =>
      prev.map(box => {
        if (box.id !== selectedTextId) return box

        const next = { ...box, ...updates }

        // Keep pdfFontSize consistent with on-screen fontSize
        if (updates.fontSize !== undefined) {
          const scaleFactor = typeof box.pdfScaleFactor === 'number' && Number.isFinite(box.pdfScaleFactor)
            ? box.pdfScaleFactor
            : (1 / 1.5)
          next.pdfScaleFactor = scaleFactor
          next.pdfFontSize = updates.fontSize * scaleFactor
        }

        return next
      })
    )
  }

  // Ctrl+Z undo functionality
  useEffect(() => {
    const handleKeyDown = async (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && undoStack.length > 0) {
        e.preventDefault()
        await performUndo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undoStack])

  const saveToUndoStack = async () => {
    if (!pdfDoc) return
    const pdfBytes = await pdfDoc.save()
    setUndoStack(prev => [...prev, pdfBytes])
  }

  const performUndo = async () => {
    if (undoStack.length === 0) return

    const newStack = [...undoStack]
    const previousState = newStack.pop()
    setUndoStack(newStack)

    // Restore previous PDF state
    const restoredPdf = await PDFDocument.load(previousState)
    setPdfDoc(restoredPdf)

    const blob = new Blob([previousState], { type: 'application/pdf' })
    const oldUrl = pdfFile
    const newUrl = URL.createObjectURL(blob)
    setPdfFile(newUrl)
    if (oldUrl) {
      setTimeout(() => URL.revokeObjectURL(oldUrl), 100)
    }
  }

  const handleAddRectangle = (rect) => {
    if (!rect) return

    const pdfScaleFactor = typeof rect.pdfScaleFactor === 'number' && Number.isFinite(rect.pdfScaleFactor)
      ? rect.pdfScaleFactor
      : (1 / 1.5)

    const newRect = {
      id: Date.now(),
      displayX: rect.displayX,
      displayY: rect.displayY,
      width: rect.width,
      height: rect.height,
      pdfX: rect.pdfX,
      pdfY: rect.pdfY,
      pdfWidth: rect.pdfWidth,
      pdfHeight: rect.pdfHeight,
      pdfScaleFactor,
      strokeColor: '#000000',
      fillColor: '#000000',
      filled: false,
      strokeWidth: 2,
      page: currentPage
    }

    setRectangleBoxes(prev => [...prev, newRect])
    setSelectedRectangleId(newRect.id)
    setSelectedTextId(null)
    setSelectedCircleId(null)
    setSelectedLineId(null)
    setEditMode(null)
  }

  const updateSelectedRectangleBox = (updates) => {
    if (!selectedRectangleId) return
    setRectangleBoxes(prev => prev.map(b => (b.id === selectedRectangleId ? { ...b, ...updates } : b)))
  }

  const handleRemoveRectangleBox = (id) => {
    setRectangleBoxes(prev => prev.filter(b => b.id !== id))
    setSelectedRectangleId(prev => (prev === id ? null : prev))
  }

  const handleAddCircle = (circle) => {
    if (!circle) return

    const pdfScaleFactor = typeof circle.pdfScaleFactor === 'number' && Number.isFinite(circle.pdfScaleFactor)
      ? circle.pdfScaleFactor
      : (1 / 1.5)

    const newCircle = {
      id: Date.now(),
      displayX: circle.displayX,
      displayY: circle.displayY,
      width: circle.width,
      height: circle.height,
      pdfX: circle.pdfX,
      pdfY: circle.pdfY,
      pdfWidth: circle.pdfWidth,
      pdfHeight: circle.pdfHeight,
      pdfScaleFactor,
      strokeColor: '#000000',
      fillColor: '#000000',
      filled: false,
      strokeWidth: 2,
      page: currentPage
    }

    setCircleBoxes(prev => [...prev, newCircle])
    setSelectedCircleId(newCircle.id)
    setSelectedTextId(null)
    setSelectedRectangleId(null)
    setSelectedLineId(null)
    setEditMode(null)
  }

  const updateSelectedCircleBox = (updates) => {
    if (!selectedCircleId) return
    setCircleBoxes(prev => prev.map(b => (b.id === selectedCircleId ? { ...b, ...updates } : b)))
  }

  const handleRemoveCircleBox = (id) => {
    setCircleBoxes(prev => prev.filter(b => b.id !== id))
    setSelectedCircleId(prev => (prev === id ? null : prev))
  }

  const handleAddLine = (line) => {
    if (!line) return

    const pdfScaleFactor = typeof line.pdfScaleFactor === 'number' && Number.isFinite(line.pdfScaleFactor)
      ? line.pdfScaleFactor
      : (1 / 1.5)

    const hasEndpoints =
      typeof line.x1 === 'number' && Number.isFinite(line.x1) &&
      typeof line.y1 === 'number' && Number.isFinite(line.y1) &&
      typeof line.x2 === 'number' && Number.isFinite(line.x2) &&
      typeof line.y2 === 'number' && Number.isFinite(line.y2)

    // Back-compat: older payloads used a box + direction.
    let x1 = line.x1
    let y1 = line.y1
    let x2 = line.x2
    let y2 = line.y2
    if (!hasEndpoints &&
      typeof line.displayX === 'number' && typeof line.displayY === 'number' &&
      typeof line.width === 'number' && typeof line.height === 'number'
    ) {
      const left = line.displayX
      const top = line.displayY
      const right = line.displayX + line.width
      const bottom = line.displayY + line.height

      const startOnRight = !!line.startOnRight
      const startOnBottom = !!line.startOnBottom

      x1 = startOnRight ? right : left
      y1 = startOnBottom ? bottom : top
      x2 = startOnRight ? left : right
      y2 = startOnBottom ? top : bottom
    }

    const newLine = {
      id: Date.now(),
      x1,
      y1,
      x2,
      y2,
      pdfX1: line.pdfX1,
      pdfY1: line.pdfY1,
      pdfX2: line.pdfX2,
      pdfY2: line.pdfY2,
      pdfScaleFactor,
      strokeColor: '#000000',
      strokeWidth: 2,
      page: currentPage
    }

    setLineBoxes(prev => [...prev, newLine])
    setSelectedLineId(newLine.id)
    setSelectedTextId(null)
    setSelectedRectangleId(null)
    setSelectedCircleId(null)
    setEditMode(null)
  }

  const updateSelectedLineBox = (updates) => {
    if (!selectedLineId) return
    setLineBoxes(prev => prev.map(b => (b.id === selectedLineId ? { ...b, ...updates } : b)))
  }

  const handleRemoveLineBox = (id) => {
    setLineBoxes(prev => prev.filter(b => b.id !== id))
    setSelectedLineId(prev => (prev === id ? null : prev))
  }

  const handleAddHighlight = async (x, y, width, height) => {
    if (!pdfDoc) return

    await saveToUndoStack()

    const pages = pdfDoc.getPages()
    const page = pages[currentPage - 1]
    const { height: pageHeight } = page.getSize()
    const pdfY = pageHeight - y - height

    page.drawRectangle({
      x: x,
      y: pdfY,
      width: width,
      height: height,
      color: rgb(1, 1, 0),
      opacity: 0.3
    })

    await refreshPDF()
  }

  const refreshPDF = async () => {
    // Save the current PDF document
    const pdfBytes = await pdfDoc.save()
    const blob = new Blob([pdfBytes], { type: 'application/pdf' })
    
    // Reload the PDF document to ensure we're working with the latest version
    const arrayBuffer = await blob.arrayBuffer()
    const reloadedPdf = await PDFDocument.load(arrayBuffer)
    setPdfDoc(reloadedPdf)
    
    // Create new URL and revoke old one to force reload
    const oldUrl = pdfFile
    const newUrl = URL.createObjectURL(blob)
    setPdfFile(newUrl)
    if (oldUrl) {
      setTimeout(() => URL.revokeObjectURL(oldUrl), 100)
    }
  }

  const buildExportPdfBytes = async () => {
    // Export: bake overlays into a temporary copy of the PDF.
    const exportBytes = await pdfDoc.save()
    const exportDoc = await PDFDocument.load(exportBytes)

    const validTextBoxes = textBoxes.filter(box => box.text.trim())
    await applyTextBoxesToPdf(exportDoc, validTextBoxes)
    await applyImageBoxesToPdf(exportDoc, imageBoxes)
    await applyTextSelectionsToPdf(exportDoc, textSelections)
    await applyRectangleBoxesToPdf(exportDoc, rectangleBoxes)
    await applyCircleBoxesToPdf(exportDoc, circleBoxes)
    await applyLineBoxesToPdf(exportDoc, lineBoxes)

    return exportDoc.save()
  }

  const triggerBrowserDownload = (bytes, filename) => {
    const blob = new Blob([bytes], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename || 'edited-document.pdf'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  const handleNormalDownload = async () => {
    if (!pdfDoc) return
    const pdfBytes = await buildExportPdfBytes()
    triggerBrowserDownload(pdfBytes, 'edited-document.pdf')
  }

  const handleSecureDownload = async () => {
    if (!pdfDoc) return

    const pdfBytes = await buildExportPdfBytes()
    let downloadBytes = pdfBytes

    // Persist to secure backend storage by creating a new version, then download the saved bytes.
    // After a successful save, reload that saved version into the editor so the visible PDF,
    // the active docId, and the Git metadata all refer to the same document.
    if (docId) {
      try {
        const fd = new FormData()
        fd.append('pdf', new Blob([pdfBytes], { type: 'application/pdf' }), 'edited.pdf')

        const res = await api.post(`/documents/${docId}/update`, fd)
        const newId = res.data?.id
        if (!newId) throw new Error('Update failed')

        const downloadRes = await api.get(`/documents/${newId}/download`, { responseType: 'arraybuffer' })
        downloadBytes = downloadRes.data

        // Refresh editor state to the newly stored, sanitized PDF version.
        const blob = new Blob([downloadBytes], { type: 'application/pdf' })
        const arrayBuffer = await blob.arrayBuffer()
        const pdf = await PDFDocument.load(arrayBuffer)

        setDocId(newId)
        setPdfDoc(pdf)
        const oldUrl = pdfFile
        const newUrl = URL.createObjectURL(blob)
        setPdfFile(newUrl)
        if (oldUrl) setTimeout(() => URL.revokeObjectURL(oldUrl), 100)

        setTotalPages(pdf.getPageCount())
        setCurrentPage(1)
        setUndoStack([])
        setTextBoxes([])
        setImageBoxes([])
        setTextSelections([])
        setRectangleBoxes([])
        setCircleBoxes([])
        setLineBoxes([])
        setEditMode(null)
        setSelectedTextId(null)
        setSelectedRectangleId(null)
        setSelectedCircleId(null)
        setSelectedLineId(null)
        
        // Refresh recent docs after saving
        fetchRecentDocs()
      } catch (e) {
        console.error(e)
        alert(e?.response?.data?.error || e.message || 'Failed to save securely (download will still proceed)')
      }
    }

    triggerBrowserDownload(downloadBytes, 'edited-document.pdf')
  }

  const handleSecureRedact = async () => {
    try {
      if (!docId || !pdfDoc) {
        alert('No document loaded')
        return
      }

      // Treat FILLED black rectangles as redactions.
      const candidates = rectangleBoxes.filter(b => b?.filled === true)
      if (candidates.length === 0) {
        alert('Draw a filled rectangle to redact')
        return
      }

      const pages = pdfDoc.getPages()
      const redactionsByPage = new Map()

      for (const r of candidates) {
        const pageIndex = (r.page || 1) - 1
        const page = pages[pageIndex]
        if (!page) continue
        const { width, height } = page.getSize()

        const x = (r.pdfX || 0) / width
        const y = (r.pdfY || 0) / height
        const w = (r.pdfWidth ?? r.width ?? 0) / width
        const h = (r.pdfHeight ?? r.height ?? 0) / height

        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) continue
        const entry = redactionsByPage.get(r.page) || []
        entry.push({ x, y, width: w, height: h })
        redactionsByPage.set(r.page, entry)
      }

      const redactions = Array.from(redactionsByPage.entries()).map(([page, rects]) => ({ page, rects }))
      const res = await api.post(`/documents/${docId}/redact`, { redactions })
      const newId = res.data?.id
      if (!newId) throw new Error('Redaction failed')

      const downloadRes = await api.get(`/documents/${newId}/download`, { responseType: 'arraybuffer' })
      const bytes = downloadRes.data
      const blob = new Blob([bytes], { type: 'application/pdf' })
      const arrayBuffer = await blob.arrayBuffer()
      const pdf = await PDFDocument.load(arrayBuffer)

      setDocId(newId)
      setPdfDoc(pdf)
      const oldUrl = pdfFile
      const newUrl = URL.createObjectURL(blob)
      setPdfFile(newUrl)
      if (oldUrl) setTimeout(() => URL.revokeObjectURL(oldUrl), 100)

      setTotalPages(pdf.getPageCount())
      setCurrentPage(1)
      setUndoStack([])
      setTextBoxes([])
      setImageBoxes([])
      setTextSelections([])
      setRectangleBoxes([])
      setCircleBoxes([])
      setLineBoxes([])
      setEditMode(null)
      setSelectedTextId(null)
      setSelectedRectangleId(null)
      setSelectedCircleId(null)
      setSelectedLineId(null)
    } catch (e) {
      console.error(e)
      alert(e?.response?.data?.error || e.message || 'Redaction failed')
    }
  }

  const handleEmbeddedSign = async () => {
    try {
      if (!docId || !pdfDoc) {
        alert('No document loaded')
        return
      }

      if (embeddedSigning) return
      setEmbeddedSigning(true)

      const res = await api.post(`/documents/${docId}/sign-embedded`)
      const newId = res.data?.id
      if (!newId) throw new Error('Embedded signing failed')

      const downloadRes = await api.get(`/documents/${newId}/download`, { responseType: 'arraybuffer' })
      const bytes = downloadRes.data
      const blob = new Blob([bytes], { type: 'application/pdf' })
      const arrayBuffer = await blob.arrayBuffer()
      const pdf = await PDFDocument.load(arrayBuffer)

      setDocId(newId)
      setPdfDoc(pdf)
      const oldUrl = pdfFile
      const newUrl = URL.createObjectURL(blob)
      setPdfFile(newUrl)
      if (oldUrl) setTimeout(() => URL.revokeObjectURL(oldUrl), 100)

      setTotalPages(pdf.getPageCount())
      setCurrentPage(1)
      setUndoStack([])
      setTextBoxes([])
      setImageBoxes([])
      setTextSelections([])
      setRectangleBoxes([])
      setCircleBoxes([])
      setLineBoxes([])
      setEditMode(null)
      setSelectedTextId(null)
      setSelectedRectangleId(null)
      setSelectedCircleId(null)
      setSelectedLineId(null)
    } catch (e) {
      console.error(e)
      alert(e?.response?.data?.error || e.message || 'Embedded signing failed')
    } finally {
      setEmbeddedSigning(false)
    }
  }

  const handleInspectEmbeddedSignature = async () => {
    try {
      if (!docId) {
        alert('No document loaded')
        return
      }
      const res = await api.get(`/documents/${docId}/inspect-embedded-signature`)
      const inspection = res.data?.inspection
      if (!inspection) throw new Error('Inspection failed')
      alert(inspection.looksSigned ? 'Embedded signature detected' : 'No embedded signature detected')
    } catch (e) {
      console.error(e)
      alert(e?.response?.data?.error || e.message || 'Inspection failed')
    }
  }

  const handlePageChange = (direction) => {
    if (direction === 'next' && currentPage < totalPages) {
      setCurrentPage(currentPage + 1)
    } else if (direction === 'prev' && currentPage > 1) {
      setCurrentPage(currentPage - 1)
    }
    // Don't remove text boxes - keep them all in state
    // Only render the ones for the current page
  }

  // PDF to Images conversion
  const handlePdfToImages = async () => {
    if (!convertPdfFile) {
      alert('Please select a PDF file first')
      return
    }

    setConverting(true)

    try {
      const formData = new FormData()
      formData.append('pdf', convertPdfFile)

      const response = await api.post('/pdf-to-images', formData, {
        responseType: 'blob'
      })

      const blob = new Blob([response.data], { type: 'application/zip' })
      const url = window.URL.createObjectURL(blob)
      
      const link = document.createElement('a')
      link.href = url
      link.download = `${convertPdfFile.name.replace('.pdf', '')}_images.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      alert('PDF converted to images successfully!')
      setConvertPdfFile(null)
    } catch (error) {
      console.error('Error converting PDF:', error)
      alert('Failed to convert PDF to images. Please try again.')
    } finally {
      setConverting(false)
    }
  }

  // Images to PDF conversion
  const handleImagesToPdf = async () => {
    if (convertImageFiles.length === 0) {
      alert('Please select at least one image file')
      return
    }

    setConverting(true)

    try {
      const formData = new FormData()
      convertImageFiles.forEach((file) => {
        formData.append('images', file)
      })

      const response = await api.post('/images-to-pdf', formData, {
        responseType: 'blob'
      })

      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      
      const link = document.createElement('a')
      link.href = url
      link.download = 'converted.pdf'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      alert('Images converted to PDF successfully!')
      setConvertImageFiles([])
    } catch (error) {
      console.error('Error converting images:', error)
      alert('Failed to convert images to PDF. Please try again.')
    } finally {
      setConverting(false)
    }
  }

  const handleConvertPdfFileSelect = (event) => {
    const file = event.target.files[0]
    if (file && file.type === 'application/pdf') {
      setConvertPdfFile(file)
    } else {
      alert('Please select a valid PDF file')
    }
  }

  const handleConvertImageFilesSelect = (event) => {
    const files = Array.from(event.target.files)
    const validImages = files.filter(file => 
      file.type === 'image/jpeg' || 
      file.type === 'image/png' || 
      file.type === 'image/jpg'
    )
    
    if (validImages.length === 0) {
      alert('Please select valid image files (JPG, PNG)')
      return
    }
    
    setConvertImageFiles(validImages)
  }

  // PDF Merge
  const handleMergePdfFilesSelect = (event) => {
    const files = Array.from(event.target.files || [])
    const validPdfs = files.filter((file) => {
      const name = String(file?.name || '').toLowerCase()
      const type = String(file?.type || '').toLowerCase()
      return type.includes('pdf') || name.endsWith('.pdf')
    })

    if (validPdfs.length < 2) {
      alert('Please select at least 2 PDF files')
      setMergePdfFiles([])
      return
    }

    setMergePdfFiles(validPdfs)
  }

  const moveMergePdfFile = (fromIndex, toIndex) => {
    setMergePdfFiles((prev) => {
      if (!Array.isArray(prev)) return prev
      if (fromIndex < 0 || toIndex < 0) return prev
      if (fromIndex >= prev.length || toIndex >= prev.length) return prev
      if (fromIndex === toIndex) return prev

      const next = [...prev]
      const [item] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, item)
      return next
    })
  }

  const handleMergePdfs = async () => {
    if (mergePdfFiles.length < 2) {
      alert('Please select at least 2 PDF files')
      return
    }

    setConverting(true)
    try {
      const formData = new FormData()
      mergePdfFiles.forEach((file) => formData.append('pdfs', file))

      const response = await api.post('/merge-pdfs', formData, {
        responseType: 'blob'
      })

      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.href = url
      link.download = 'merged.pdf'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      alert('PDFs merged successfully!')
      setMergePdfFiles([])
    } catch (error) {
      console.error('Error merging PDFs:', error)
      alert(error?.response?.data?.error || 'Failed to merge PDFs. Please try again.')
    } finally {
      setConverting(false)
    }
  }

  // PPT to PDF
  const handlePptFileSelect = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const name = String(file.name || '').toLowerCase()
    if (!name.endsWith('.ppt') && !name.endsWith('.pptx')) {
      alert('Please select a PPT or PPTX file')
      setPptFile(null)
      return
    }
    setPptFile(file)
  }

  const handlePptToPdf = async () => {
    if (!pptFile) {
      alert('Please select a PPT/PPTX file first')
      return
    }

    setConverting(true)
    try {
      const formData = new FormData()
      formData.append('ppt', pptFile)

      const response = await api.post('/ppt-to-pdf', formData, {
        responseType: 'blob'
      })

      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.href = url
      link.download = `${pptFile.name.replace(/\.(pptx|ppt)$/i, '')}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      alert('PPT converted to PDF successfully!')
      setPptFile(null)
    } catch (error) {
      console.error('Error converting PPT to PDF:', error)
      alert(error?.response?.data?.error || 'Failed to convert PPT to PDF. Please try again.')
    } finally {
      setConverting(false)
    }
  }

  return (
    <div className="pdf-editor">
      <header className="app-header small" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', boxSizing: 'border-box', borderBottom: '1px solid rgba(140, 148, 145, 0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h1 className="header-title" style={{ margin: 0, color: '#D2C1B6', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img 
              src="/images/iitr_logo.png" 
              alt="Logo" 
              className="header-logo"
              style={{ width: '22px', height: '22px' }}
            />
            PDF Editor
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          {/* Profile Menu */}
          <div 
            ref={profileMenuRef}
            style={{ 
              position: 'relative',
              zIndex: 1000
            }}
          >
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px',
              borderRadius: '50%',
              backgroundColor: 'rgba(210, 193, 182, 0.1)',
              transition: 'background-color 0.2s',
            }}
            title="Profile Menu"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D2C1B6" strokeWidth="2" strokeLinecap="round" strokeLinelinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </button>

          {showProfileMenu && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '10px',
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              minWidth: '200px',
              padding: '1rem',
              textAlign: 'left',
              border: '1px solid #8C9491',
              fontFamily: '"Montserrat", sans-serif'
            }}>
              <div style={{ 
                borderBottom: '1px solid rgba(140, 148, 145, 0.3)', 
                paddingBottom: '0.8rem',
                marginBottom: '0.8rem'
              }}>
                <div style={{ color: '#1B3C53', fontWeight: '700', fontSize: '1.1rem', marginBottom: '0.2rem' }}>
                  {currentUser?.name || 'User'}
                </div>
                <div style={{ color: '#456882', fontSize: '0.85rem' }}>
                  {currentUser?.email || ''}
                </div>
              </div>
              <button
                onClick={onLogout}
                style={{
                  width: '100%',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  padding: '10px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontFamily: '"Montserrat", sans-serif',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinelinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                Logout
              </button>
            </div>
          )}
        </div>
        </div>
      </header>
      {!pdfFile ? (
        loadingPdf || uploadingPdf ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', width: '100%' }}>
            <div style={{ color: '#1B3C53', fontSize: '1.8rem', marginBottom: '20px', fontFamily: '"Oswald", sans-serif' }}>
              {loadingPdf ? 'Loading document...' : 'Uploading & sanitizing...'}
            </div>
            <div style={{
              width: '40px',
              height: '40px',
              border: '4px solid rgba(27, 60, 83, 0.2)',
              borderTop: '4px solid #1B3C53',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        ) : (
        <div className="upload-section">
          <h2 style={{ 
            color: '#1B3C53', 
            fontFamily: '"Oswald", sans-serif', 
            fontSize: '2.5rem', 
            marginBottom: '2rem',
            marginTop: 0
          }}>
            Hi, {currentUser?.name || currentUser?.email || 'User'}
          </h2>
          <input
            type="file"
            accept="application/pdf"
            onChange={handleFileUpload}
            ref={fileInputRef}
            style={{ display: 'none' }}
          />
          <button 
            className="upload-btn"
            onClick={() => fileInputRef.current.click()}
            disabled={uploadingPdf || loadingPdf}
          >
            {uploadingPdf ? 'Uploading & sanitizing…' : loadingPdf ? 'Loading document…' : 'Click to select a PDF file to edit'}
          </button>
          
          <div className="conversion-section">
            <h3>Quick Conversion Tools</h3>

            <div className="conversion-tools-grid">
              <div className="conversion-tool">
                <h4>PDF to Images</h4>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleConvertPdfFileSelect}
                  ref={convertPdfInputRef}
                  style={{ display: 'none' }}
                />
                <button 
                  className="conversion-btn"
                  onClick={() => convertPdfInputRef.current.click()}
                >
                  {convertPdfFile ? `Selected: ${convertPdfFile.name}` : 'Choose PDF'}
                </button>
                {convertPdfFile && (
                  <button 
                    className="convert-action-btn"
                    onClick={handlePdfToImages}
                    disabled={converting}
                  >
                    {converting ? 'Converting...' : 'Convert to Images'}
                  </button>
                )}
              </div>

              <div className="conversion-tool">
                <h4>Images to PDF</h4>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/jpg"
                  onChange={handleConvertImageFilesSelect}
                  ref={convertImageInputRef}
                  multiple
                  style={{ display: 'none' }}
                />
                <button 
                  className="conversion-btn"
                  onClick={() => convertImageInputRef.current.click()}
                >
                  {convertImageFiles.length > 0 
                    ? `Selected: ${convertImageFiles.length} image${convertImageFiles.length > 1 ? 's' : ''}`
                    : 'Choose Images'
                  }
                </button>
                {convertImageFiles.length > 0 && (
                  <button 
                    className="convert-action-btn"
                    onClick={handleImagesToPdf}
                    disabled={converting}
                  >
                    {converting ? 'Converting...' : 'Convert to PDF'}
                  </button>
                )}
              </div>

              <div className="conversion-tool">
                <h4>Merge PDFs</h4>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleMergePdfFilesSelect}
                  ref={mergePdfInputRef}
                  multiple
                  style={{ display: 'none' }}
                />
                <button
                  className="conversion-btn"
                  onClick={() => mergePdfInputRef.current.click()}
                >
                  {mergePdfFiles.length > 0
                    ? `Selected: ${mergePdfFiles.length} PDF${mergePdfFiles.length > 1 ? 's' : ''}`
                    : 'Choose PDFs'
                  }
                </button>

                {mergePdfFiles.length > 0 && (
                  <div className="merge-order">
                    <div className="merge-order-title">Order</div>
                    <div className="merge-order-list">
                      {mergePdfFiles.map((file, index) => (
                        <div className="merge-order-item" key={`${file.name}-${index}`}>
                          <div className="merge-order-name" title={file.name}>
                            {index + 1}. {file.name}
                          </div>
                          <div className="merge-order-controls">
                            <button
                              type="button"
                              className="merge-order-btn"
                              onClick={() => moveMergePdfFile(index, index - 1)}
                              disabled={converting || index === 0}
                              title="Move up"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              className="merge-order-btn"
                              onClick={() => moveMergePdfFile(index, index + 1)}
                              disabled={converting || index === mergePdfFiles.length - 1}
                              title="Move down"
                            >
                              ↓
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {mergePdfFiles.length > 0 && (
                  <button
                    className="convert-action-btn"
                    onClick={handleMergePdfs}
                    disabled={converting}
                  >
                    {converting ? 'Merging...' : 'Merge PDFs'}
                  </button>
                )}
              </div>

              <div className="conversion-tool">
                <h4>PPT to PDF</h4>
                <input
                  type="file"
                  accept=".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                  onChange={handlePptFileSelect}
                  ref={pptInputRef}
                  style={{ display: 'none' }}
                />
                <button
                  className="conversion-btn"
                  onClick={() => pptInputRef.current.click()}
                >
                  {pptFile ? `Selected: ${pptFile.name}` : 'Choose PPT'}
                </button>
                {pptFile && (
                  <button
                    className="convert-action-btn"
                    onClick={handlePptToPdf}
                    disabled={converting}
                  >
                    {converting ? 'Converting...' : 'Convert to PDF'}
                  </button>
                )}
              </div>
            </div>

            <div style={{ marginTop: '24px', width: '100%' }}>
              <div style={{
                padding: '16px 20px',
                borderBottom: '1px solid #eee',
                fontWeight: '600',
                color: '#1B3C53',
                fontFamily: '"Oswald", sans-serif',
                fontSize: '1.2rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                Recent PDFs
                <span style={{ fontSize: '0.85rem', fontWeight: '400', color: '#8C9491', fontFamily: '"Montserrat", sans-serif' }}>
                  {recentDocs.length} shown
                </span>
              </div>

              {recentDocs.length === 0 ? (
                <div style={{ padding: '22px 20px', textAlign: 'center', color: '#8C9491', fontSize: '0.95rem' }}>
                  No recent PDFs found
                </div>
              ) : (
                <div style={{ border: '1px solid rgba(140, 148, 145, 0.2)' }}>
                  {recentDocs.map(doc => (
                    <div
                      key={doc._id}
                      onClick={() => {
                        window.location.href = `/?doc=${doc._id}`
                      }}
                      style={{
                        padding: '14px 20px',
                        borderBottom: '1px solid #f5f5f5',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <div style={{ color: '#1B3C53', fontWeight: '600', fontSize: '1.02rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {doc.originalName || 'Untitled Document'}
                      </div>
                      <div style={{ color: '#8C9491', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{new Date(doc.updatedAt).toLocaleDateString()}</span>
                        <span>{new Date(doc.updatedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
        )
      ) : (
        <>
          <Toolbar
            editMode={editMode}
            setEditMode={setEditMode}
            fontSize={fontSize}
            setFontSize={setFontSize}
            onDownload={handleNormalDownload}
            onSecureDownload={handleSecureDownload}
            onUndo={performUndo}
            onApplyText={handleApplyText}
            hasTextBoxes={textBoxes.length > 0}
            fontFamily={fontFamily}
            setFontFamily={setFontFamily}
            updateSelectedTextBox={updateSelectedTextBox}
            selectedTextId={selectedTextId}
            onDeselectText={() => setSelectedTextId(null)}
            textBoxes={textBoxes}
            selectedRectangleId={selectedRectangleId}
            rectangleBoxes={rectangleBoxes}
            updateSelectedRectangleBox={updateSelectedRectangleBox}
            onDeselectRectangle={() => setSelectedRectangleId(null)}
            onRemoveRectangleBox={handleRemoveRectangleBox}
            selectedCircleId={selectedCircleId}
            circleBoxes={circleBoxes}
            updateSelectedCircleBox={updateSelectedCircleBox}
            onDeselectCircle={() => setSelectedCircleId(null)}
            onRemoveCircleBox={handleRemoveCircleBox}
            selectedLineId={selectedLineId}
            lineBoxes={lineBoxes}
            updateSelectedLineBox={updateSelectedLineBox}
            onDeselectLine={() => setSelectedLineId(null)}
            onRemoveLineBox={handleRemoveLineBox}
            onApplyImages={handleApplyImages}
            hasImages={imageBoxes.length > 0}
            onImageUpload={() => imageInputRef.current.click()}
            onApplyHighlights={handleApplyHighlights}
            hasTextSelections={textSelections.length > 0}
            canUndo={undoStack.length > 0}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            onUploadNew={() => fileInputRef.current.click()}
            onSecureRedact={handleSecureRedact}
            canSecureRedact={rectangleBoxes.some(b => b?.filled === true)}
            onEmbeddedSign={handleEmbeddedSign}
            embeddedSignDisabled={embeddedSigning}
            onInspectEmbeddedSignature={handleInspectEmbeddedSignature}
            onLogout={onLogout}
            gitEnabled={gitEnabled}
            gitSignatureOk={gitSignatureOk}
            gitDocId={docId}
            onGitInit={handleGitInit}
            onGitHistory={handleGitHistory}
            onGitVerify={handleGitVerify}
          />
          <input
            type="file"
            accept="application/pdf"
            onChange={handleFileUpload}
            ref={fileInputRef}
            style={{ display: 'none' }}
          />
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            ref={imageInputRef}
            style={{ display: 'none' }}
          />
          <PDFViewer
            pdfFile={pdfFile}
            currentPage={currentPage}
            editMode={editMode}
            textBoxes={textBoxes.filter(box => box.page === currentPage)}
            imageBoxes={imageBoxes.filter(box => box.page === currentPage)}
            textSelections={textSelections.filter(sel => sel.page === currentPage)}
            rectangleBoxes={rectangleBoxes.filter(b => b.page === currentPage)}
            selectedTextId={selectedTextId}
            setSelectedTextId={setSelectedTextId}
            selectedRectangleId={selectedRectangleId}
            setSelectedRectangleId={setSelectedRectangleId}
            circleBoxes={circleBoxes.filter(b => b.page === currentPage)}
            selectedCircleId={selectedCircleId}
            setSelectedCircleId={setSelectedCircleId}
            lineBoxes={lineBoxes.filter(b => b.page === currentPage)}
            selectedLineId={selectedLineId}
            setSelectedLineId={setSelectedLineId}
            autoFocusTextBoxId={autoFocusTextBoxId}
            onAutoFocusTextBoxDone={() => setAutoFocusTextBoxId(null)}
            onAddTextBox={handleAddTextBox}
            onUpdateTextBox={handleUpdateTextBox}
            onRemoveTextBox={handleRemoveTextBox}
            onUpdateImageBox={handleUpdateImageBox}
            onRemoveImageBox={handleRemoveImageBox}
            onUpdateRectangleBox={(id, updates) => {
              setRectangleBoxes(prev => prev.map(b => (b.id === id ? { ...b, ...updates } : b)))
            }}
            onRemoveRectangleBox={handleRemoveRectangleBox}
            onUpdateCircleBox={(id, updates) => {
              setCircleBoxes(prev => prev.map(b => (b.id === id ? { ...b, ...updates } : b)))
            }}
            onRemoveCircleBox={handleRemoveCircleBox}
            onUpdateLineBox={(id, updates) => {
              setLineBoxes(prev => prev.map(b => (b.id === id ? { ...b, ...updates } : b)))
            }}
            onRemoveLineBox={handleRemoveLineBox}
            onTextSelection={handleTextSelection}
            onRemoveSelection={handleRemoveSelection}
            onAddRectangle={handleAddRectangle}
            onAddCircle={handleAddCircle}
            onAddLine={handleAddLine}
            onAddHighlight={handleAddHighlight}
          />
        </>
      )}
    </div>
  )
}

export default PDFEditor
