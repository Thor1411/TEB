import { useState, useRef, useEffect } from 'react'
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import axios from 'axios'
import PDFViewer from './PDFViewer'
import Toolbar from './Toolbar'
import './PDFEditor.css'

function PDFEditor() {
  const [pdfFile, setPdfFile] = useState(null)
  const [pdfDoc, setPdfDoc] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
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
  const [converting, setConverting] = useState(false)
  const convertPdfInputRef = useRef(null)
  const convertImageInputRef = useRef(null)

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
    if (file && file.type === 'application/pdf') {
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await PDFDocument.load(arrayBuffer)
      setPdfDoc(pdf)
      setPdfFile(URL.createObjectURL(file))
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
    } else {
      alert('Please upload a valid PDF file')
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

  const handleDownload = async () => {
    if (!pdfDoc) return

    // Export-only: bake overlays into a temporary copy of the PDF for download.
    // Keep editor state (text boxes / images / highlights) unchanged.
    const exportBytes = await pdfDoc.save()
    const exportDoc = await PDFDocument.load(exportBytes)

    const validTextBoxes = textBoxes.filter(box => box.text.trim())
    await applyTextBoxesToPdf(exportDoc, validTextBoxes)
    await applyImageBoxesToPdf(exportDoc, imageBoxes)
    await applyTextSelectionsToPdf(exportDoc, textSelections)
    await applyRectangleBoxesToPdf(exportDoc, rectangleBoxes)
    await applyCircleBoxesToPdf(exportDoc, circleBoxes)
    await applyLineBoxesToPdf(exportDoc, lineBoxes)

    const pdfBytes = await exportDoc.save()
    const blob = new Blob([pdfBytes], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'edited-document.pdf'
    link.click()
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

      const response = await axios.post('http://localhost:5000/api/pdf-to-images', formData, {
        responseType: 'blob',
        headers: {
          'Content-Type': 'multipart/form-data'
        }
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

      const response = await axios.post('http://localhost:5000/api/images-to-pdf', formData, {
        responseType: 'blob',
        headers: {
          'Content-Type': 'multipart/form-data'
        }
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

  return (
    
    <div className="pdf-editor">
      <header className={`app-header ${pdfFile ? "small" : ""}`}>
        <h1 className="header-title">
          <img 
          src="/images/iitr_logo.png" 
          alt="Logo" 
          className="header-logo"
          />
        PDF Editor</h1>
        <p>Upload, edit, and download your PDF files</p>
      </header>
      {!pdfFile ? (
        <div className="upload-section">
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
          >
            Click to select a PDF file to edit
          </button>
          
          <div className="conversion-section">
            <h3>Quick Conversion Tools</h3>
            
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
          </div>
        </div>
      ) : (
        <>
          <Toolbar
            editMode={editMode}
            setEditMode={setEditMode}
            fontSize={fontSize}
            setFontSize={setFontSize}
            onDownload={handleDownload}
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
