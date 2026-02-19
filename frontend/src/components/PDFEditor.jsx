import { useState, useRef, useEffect } from 'react'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
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
  const [textBoxes, setTextBoxes] = useState([]) // Active text boxes on canvas
  const [imageBoxes, setImageBoxes] = useState([]) // Active image boxes on canvas
  const [textSelections, setTextSelections] = useState([]) // Text selections for highlighting
  const [undoStack, setUndoStack] = useState([])
  const fileInputRef = useRef(null)
  const imageInputRef = useRef(null)

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
      setEditMode(null)
    } else {
      alert('Please upload a valid PDF file')
    }
  }

  // Handle clicking on PDF to add text box
  const handleAddTextBox = (coords) => {
    if (editMode !== 'text') return

    const newTextBox = {
      id: Date.now(),
      text: '', // Empty initially - user types directly in the box
      displayX: coords.displayX, // For CSS positioning
      displayY: coords.displayY,
      pdfX: coords.pdfX, // For PDF drawing
      pdfY: coords.pdfY,
      fontSize: fontSize,
      page: currentPage
    }

    setTextBoxes([...textBoxes, newTextBox])
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
  const handleApplyText = async () => {
    // Filter out empty text boxes
    const validBoxes = textBoxes.filter(box => box.text.trim())
    
    if (validBoxes.length === 0) {
      alert('Please add some text to the text boxes')
      return
    }

    await saveToUndoStack()

    const pages = pdfDoc.getPages()
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

    // Group text boxes by page
    const boxesByPage = {}
    validBoxes.forEach(box => {
      if (!boxesByPage[box.page]) {
        boxesByPage[box.page] = []
      }
      boxesByPage[box.page].push(box)
    })

    // Add text to each page
    for (const [pageNum, boxes] of Object.entries(boxesByPage)) {
      const page = pages[parseInt(pageNum) - 1]
      const { height: pageHeight } = page.getSize()

      boxes.forEach(box => {
        // Use PDF coordinates that were calculated when placing the text box
        const pdfY = pageHeight - box.pdfY - box.fontSize
        page.drawText(box.text, {
          x: box.pdfX,
          y: pdfY,
          size: box.fontSize,
          font: font,
          color: rgb(0, 0, 0)
        })
      })
    }

    await refreshPDF()
    setTextBoxes([])
    setEditMode(null)
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

  const handleAddRectangle = async (x, y, width, height) => {
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
      borderColor: rgb(0.2, 0.4, 0.9),
      borderWidth: 2
    })

    await refreshPDF()
  }

  const handleAddCircle = async (x, y, width, height) => {
    if (!pdfDoc) return

    await saveToUndoStack()

    const pages = pdfDoc.getPages()
    const page = pages[currentPage - 1]
    const { height: pageHeight } = page.getSize()
    
    const centerX = x + width / 2
    const centerY = pageHeight - y - height / 2
    const radius = Math.min(width, height) / 2

    page.drawCircle({
      x: centerX,
      y: centerY,
      size: radius,
      borderColor: rgb(0.9, 0.4, 0.2),
      borderWidth: 2
    })

    await refreshPDF()
  }

  const handleAddLine = async (x, y, width, height) => {
    if (!pdfDoc) return

    await saveToUndoStack()

    const pages = pdfDoc.getPages()
    const page = pages[currentPage - 1]
    const { height: pageHeight } = page.getSize()
    
    const startX = x
    const startY = pageHeight - y
    const endX = x + width
    const endY = pageHeight - y - height

    page.drawLine({
      start: { x: startX, y: startY },
      end: { x: endX, y: endY },
      thickness: 2,
      color: rgb(0.4, 0.2, 0.9)
    })

    await refreshPDF()
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

    // Check if there are unapplied text boxes or images
    const validBoxes = textBoxes.filter(box => box.text.trim())
    const unappliedCount = validBoxes.length + imageBoxes.length
    
    if (unappliedCount > 0) {
      let message = ''
      if (validBoxes.length > 0 && imageBoxes.length > 0) {
        message = `You have ${validBoxes.length} text box(es) and ${imageBoxes.length} image(s) that haven't been applied yet. Apply them before downloading?`
      } else if (validBoxes.length > 0) {
        message = `You have ${validBoxes.length} text box(es) that haven't been applied yet. Apply them before downloading?`
      } else {
        message = `You have ${imageBoxes.length} image(s) that haven't been applied yet. Apply them before downloading?`
      }
      
      const shouldApply = window.confirm(message)
      if (shouldApply) {
        if (validBoxes.length > 0) await handleApplyText()
        if (imageBoxes.length > 0) await handleApplyImages()
      }
    }

    const pdfBytes = await pdfDoc.save()
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

  return (
    <div className="pdf-editor">
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
            📁 Upload PDF
          </button>
          <p className="upload-hint">Click to select a PDF file to edit</p>
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
            onAddTextBox={handleAddTextBox}
            onUpdateTextBox={handleUpdateTextBox}
            onRemoveTextBox={handleRemoveTextBox}
            onUpdateImageBox={handleUpdateImageBox}
            onRemoveImageBox={handleRemoveImageBox}
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
