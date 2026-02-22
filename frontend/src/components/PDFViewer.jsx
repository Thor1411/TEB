import { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import './PDFViewer.css'

// Set up the worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

function PDFViewer({
  pdfFile,
  currentPage,
  editMode,
  textBoxes,
  imageBoxes,
  textSelections,
  selectedTextId,
  setSelectedTextId,
  autoFocusTextBoxId,
  onAutoFocusTextBoxDone,
  onAddTextBox,
  onUpdateTextBox,
  onRemoveTextBox,
  onUpdateImageBox,
  onRemoveImageBox,
  onTextSelection,
  onRemoveSelection,
  onAddRectangle,
  onAddCircle,
  onAddLine,
  onAddHighlight
}) {
  const canvasRef = useRef(null)
  const textLayerRef = useRef(null)
  const containerRef = useRef(null)
  const [pdfDocument, setPdfDocument] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState(null)
  const [dragEnd, setDragEnd] = useState(null)
  const [draggingTextBoxId, setDraggingTextBoxId] = useState(null)
  const textBoxElementsRef = useRef(new Map())
  const textDragRef = useRef(null)
  const [resizingImage, setResizingImage] = useState(null)
  const [scale] = useState(1.5)

  const getCssFontFamily = (fontKey) => {
    // Normalize older stored values (from earlier iterations)
    let key = fontKey
    if (key === 'Helvetica') key = 'helvetica'
    if (key === 'TimesRoman' || key === 'Times') key = 'times'
    if (key === 'Courier') key = 'courier'
    if (key === 'Roboto Condensed' || key === 'RobotoCondensed') key = 'roboto-condensed'
    if (key === 'Oswald') key = 'oswald'
    if (key === 'Inter') key = 'inter'
    if (key === 'Poppins') key = 'poppins'
    if (key === 'Lato') key = 'lato'

    switch (key) {
      case 'helvetica':
        return 'Helvetica, Arial, sans-serif'
      case 'times':
        return '"Times New Roman", Times, serif'
      case 'courier':
        return '"Courier New", Courier, monospace'
      case 'roboto-condensed':
        return '"Roboto Condensed", system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif'
      case 'oswald':
        return 'Oswald, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif'
      case 'inter':
        return 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif'
      case 'poppins':
        return 'Poppins, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif'
      case 'lato':
        return 'Lato, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif'
      default:
        return 'Helvetica, Arial, sans-serif'
    }
  }

  const focusContentEditableEnd = (el) => {
    if (!el) return
    el.focus()
    const selection = window.getSelection()
    if (!selection) return
    const range = document.createRange()
    range.selectNodeContents(el)
    range.collapse(false)
    selection.removeAllRanges()
    selection.addRange(range)
  }

  // Auto-focus a newly created text box so typing can start immediately
  useEffect(() => {
    if (!autoFocusTextBoxId) return

    const raf = requestAnimationFrame(() => {
      const root = containerRef.current
      if (!root) return
      const el = root.querySelector(`[data-textbox-content-id="${autoFocusTextBoxId}"]`)
      if (el) focusContentEditableEnd(el)
      if (onAutoFocusTextBoxDone) onAutoFocusTextBoxDone()
    })

    return () => cancelAnimationFrame(raf)
  }, [autoFocusTextBoxId])

  const applyTextDragFrame = () => {
    const drag = textDragRef.current
    if (!drag) return

    const canvas = canvasRef.current
    const el = textBoxElementsRef.current.get(drag.id)
    if (!canvas || !el) return

    const rect = canvas.getBoundingClientRect()

    let newDisplayX = drag.lastClientX - rect.left - drag.offsetX
    let newDisplayY = drag.lastClientY - rect.top - drag.offsetY

    // Keep the box within the visible canvas area (basic clamp)
    newDisplayX = Math.max(0, Math.min(newDisplayX, rect.width - 10))
    newDisplayY = Math.max(0, Math.min(newDisplayY, rect.height - 10))

    el.style.left = `${newDisplayX}px`
    el.style.top = `${newDisplayY}px`

    drag.lastDisplayX = newDisplayX
    drag.lastDisplayY = newDisplayY
  }

  const startTextBoxDrag = (e, box) => {
    if (!canvasRef.current) return
    if (e.button !== undefined && e.button !== 0) return
    if (!e.isPrimary) return

    e.preventDefault()

    const canvasRect = canvasRef.current.getBoundingClientRect()
    const offsetX = (e.clientX - canvasRect.left) - box.displayX
    const offsetY = (e.clientY - canvasRect.top) - box.displayY

    textDragRef.current = {
      id: box.id,
      pointerId: e.pointerId,
      offsetX,
      offsetY,
      lastClientX: e.clientX,
      lastClientY: e.clientY,
      lastDisplayX: box.displayX,
      lastDisplayY: box.displayY
    }

    setDraggingTextBoxId(box.id)
    document.body.style.userSelect = 'none'
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const moveTextBoxDrag = (e) => {
    const drag = textDragRef.current
    if (!drag) return
    if (!e.isPrimary || drag.pointerId !== e.pointerId) return

    drag.lastClientX = e.clientX
    drag.lastClientY = e.clientY

    // Update immediately for 1:1 cursor tracking (no animation)
    applyTextDragFrame()
  }

  const endTextBoxDrag = (e) => {
    const drag = textDragRef.current
    if (!drag) return
    if (!e.isPrimary || drag.pointerId !== e.pointerId) return

    applyTextDragFrame()

    document.body.style.userSelect = ''
    setDraggingTextBoxId(null)
    textDragRef.current = null

    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()

    // Convert to PDF coordinates
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const canvasX = drag.lastDisplayX * scaleX
    const canvasY = drag.lastDisplayY * scaleY
    const newPdfX = canvasX / scale
    const newPdfY = canvasY / scale

    // Commit the final position to React state (single update)
    onUpdateTextBox(drag.id, {
      displayX: drag.lastDisplayX,
      displayY: drag.lastDisplayY,
      pdfX: newPdfX,
      pdfY: newPdfY
    })
  }

  useEffect(() => {
    if (pdfFile) {
      // Clean up old document before loading new one
      if (pdfDocument) {
        pdfDocument.destroy()
        setPdfDocument(null)
      }
      loadPDF()
    }
  }, [pdfFile])

  useEffect(() => {
    if (pdfDocument) {
      renderPage()
    }
  }, [pdfDocument, currentPage, editMode])

  // Handle text selection for highlighting
  useEffect(() => {
    if (editMode !== 'highlight-select' || !textLayerRef.current) return

    const handleSelection = () => {
      const selection = window.getSelection()
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) return

      const range = selection.getRangeAt(0)
      const rects = range.getClientRects()
      
      if (rects.length === 0) return

      const canvas = canvasRef.current
      const canvasRect = canvas.getBoundingClientRect()
      
      // Convert selection rectangles to PDF coordinates
      const selectionRects = []
      for (let i = 0; i < rects.length; i++) {
        const rect = rects[i]
        const x = rect.left - canvasRect.left
        const y = rect.top - canvasRect.top
        const width = rect.width
        const height = rect.height

        // Convert to PDF coordinates
        const scaleX = canvas.width / canvasRect.width
        const scaleY = canvas.height / canvasRect.height
        
        const pdfX = (x * scaleX) / scale
        const pdfY = (y * scaleY) / scale
        const pdfWidth = (width * scaleX) / scale
        const pdfHeight = (height * scaleY) / scale

        selectionRects.push({ x: pdfX, y: pdfY, width: pdfWidth, height: pdfHeight })
      }

      if (selectionRects.length > 0) {
        onTextSelection({ rects: selectionRects })
        selection.removeAllRanges()
      }
    }

    document.addEventListener('mouseup', handleSelection)
    return () => document.removeEventListener('mouseup', handleSelection)
  }, [editMode, pdfDocument, currentPage])

  // Handle image resize
  useEffect(() => {
    if (!resizingImage) return

    const handleMouseMove = (e) => {
      const deltaX = e.clientX - resizingImage.startX
      const deltaY = e.clientY - resizingImage.startY
      const newWidth = Math.max(50, resizingImage.startWidth + deltaX)
      const newHeight = Math.max(50, resizingImage.startHeight + deltaY)
      
      onUpdateImageBox(resizingImage.id, { width: newWidth, height: newHeight })
    }

    const handleMouseUp = () => {
      setResizingImage(null)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [resizingImage])

  const loadPDF = async () => {
    try {
      const loadingTask = pdfjsLib.getDocument(pdfFile)
      const pdf = await loadingTask.promise
      setPdfDocument(pdf)
    } catch (error) {
      console.error('Error loading PDF:', error)
    }
  }

  const renderPage = async () => {
    if (!pdfDocument || !canvasRef.current) return

    const page = await pdfDocument.getPage(currentPage)
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')

    const viewport = page.getViewport({ scale: scale })
    canvas.height = viewport.height
    canvas.width = viewport.width

    const renderContext = {
      canvasContext: context,
      viewport: viewport
    }

    await page.render(renderContext).promise

    // Render text layer for selection
    if (editMode === 'highlight-select') {
      await renderTextLayer(page, viewport)
    }
  }

  const renderTextLayer = async (page, viewport) => {
    if (!textLayerRef.current) return

    // Clear existing text layer
    textLayerRef.current.innerHTML = ''
    textLayerRef.current.style.width = `${viewport.width}px`
    textLayerRef.current.style.height = `${viewport.height}px`

    const textContent = await page.getTextContent()
    
    // Enable text selection
    textLayerRef.current.style.userSelect = 'text'
    textLayerRef.current.style.pointerEvents = 'auto'

    // Render text items
    textContent.items.forEach(item => {
      const tx = pdfjsLib.Util.transform(
        pdfjsLib.Util.transform(viewport.transform, item.transform),
        [1, 0, 0, -1, 0, 0]
      )

      const span = document.createElement('span')
      span.textContent = item.str
      span.style.position = 'absolute'
      span.style.left = `${tx[4]}px`
      span.style.top = `${tx[5]}px`
      span.style.fontSize = `${Math.abs(tx[0])}px`
      span.style.fontFamily = 'sans-serif'
      span.style.opacity = '0.2' // Make it semi-transparent so user can see PDF beneath

      textLayerRef.current.appendChild(span)
    })
  }

  const handleMouseDown = (event) => {
    if (!editMode) return
    setSelectedTextId(null)
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    // For text mode, click to place box (not drag)
    if (editMode === 'text') {
      // Convert display coordinates to PDF coordinates
      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height
      
      const canvasX = x * scaleX
      const canvasY = y * scaleY
      
      const pdfX = canvasX / scale
      const pdfY = canvasY / scale

      // Conversion factor from CSS pixels (display) -> PDF units (points)
      // This is the same factor used for x/y conversion.
      const pdfScaleFactor = scaleX / scale
      
      // Store both PDF coordinates (for applying) and display coordinates (for rendering overlay)
      onAddTextBox({ displayX: x, displayY: y, pdfX, pdfY, pdfScaleFactor })
    } else {
      // For shapes, start drag
      setIsDragging(true)
      setDragStart({ x, y })
      setDragEnd({ x, y })
    }
  }

  const handleMouseMove = (event) => {
    if (!isDragging || !editMode) return

    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    setDragEnd({ x, y })
  }

  const handleMouseUp = (event) => {
    if (!isDragging || !editMode) return

    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()

    // Convert from display coordinates to canvas coordinates
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    // Get coordinates in canvas space
    const canvasX1 = Math.min(dragStart.x, dragEnd.x) * scaleX
    const canvasY1 = Math.min(dragStart.y, dragEnd.y) * scaleY
    const canvasX2 = Math.max(dragStart.x, dragEnd.x) * scaleX
    const canvasY2 = Math.max(dragStart.y, dragEnd.y) * scaleY

    // Convert from canvas coordinates to PDF coordinates by dividing by the scale factor
    const pdfX1 = canvasX1 / scale
    const pdfY1 = canvasY1 / scale
    const pdfX2 = canvasX2 / scale
    const pdfY2 = canvasY2 / scale

    const width = pdfX2 - pdfX1
    const height = pdfY2 - pdfY1

    // Require minimum drag size for shapes
    if (width > 10 && height > 10) {
      if (editMode === 'rectangle') {
        onAddRectangle(pdfX1, pdfY1, width, height)
      } else if (editMode === 'circle') {
        onAddCircle(pdfX1, pdfY1, width, height)
      } else if (editMode === 'line') {
        onAddLine(pdfX1, pdfY1, width, height)
      } else if (editMode === 'highlight') {
        onAddHighlight(pdfX1, pdfY1, width, height)
      }
    }

    // Reset drag state
    setIsDragging(false)
    setDragStart(null)
    setDragEnd(null)
  }

  const getEditModeLabel = () => {
    switch(editMode) {
      case 'text': return 'Click to add text box, then type directly in it'
      case 'rectangle': return 'Drag to draw rectangle'
      case 'circle': return 'Drag to draw circle'
      case 'line': return 'Drag to draw line'
      case 'highlight': return 'Drag to highlight (draw mode)'
      case 'highlight-select': return 'Select text to highlight'
      default: return ''
    }
  }

  // Calculate drag rectangle for visual feedback
  const getDragRect = () => {
    if (!isDragging || !dragStart || !dragEnd) return null

    return {
      left: Math.min(dragStart.x, dragEnd.x),
      top: Math.min(dragStart.y, dragEnd.y),
      width: Math.abs(dragEnd.x - dragStart.x),
      height: Math.abs(dragEnd.y - dragStart.y)
    }
  }

  const dragRect = getDragRect()

  return (
    <div className="pdf-viewer">
      <div
        className="canvas-container"
        ref={containerRef}
        onMouseDownCapture={(e) => {
          // Deselect text box when clicking anywhere outside a text box
          // (capture phase ensures this runs even if child stops propagation)
          const targetEl = e.target instanceof Element ? e.target : e.target?.parentElement
          if (targetEl && targetEl.closest && targetEl.closest('.text-box')) return
          setSelectedTextId(null)
        }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={editMode ? `edit-mode ${editMode}-mode` : ''}
        />
        {/* Text layer for selection */}
        <div 
          ref={textLayerRef} 
          className="text-layer"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            pointerEvents: editMode === 'highlight-select' ? 'auto' : 'none',
            userSelect: editMode === 'highlight-select' ? 'text' : 'none'
          }}
        />
        {/* Text selection highlights */}
        {textSelections && textSelections.map(selection => (
          <div key={selection.id} className="selection-group">
            {selection.rects.map((rect, idx) => (
              <div
                key={`${selection.id}-${idx}`}
                className="text-selection-highlight"
                style={{
                  left: `${rect.x}px`,
                  top: `${rect.y}px`,
                  width: `${rect.width}px`,
                  height: `${rect.height}px`
                }}
              />
            ))}
            <button
              className="selection-delete"
              onClick={() => onRemoveSelection(selection.id)}
              style={{
                left: `${selection.rects[0].x + selection.rects[0].width}px`,
                top: `${selection.rects[0].y - 10}px`
              }}
              title="Remove highlight"
            >
              ×
            </button>
          </div>
        ))}
        {/* Draggable text boxes */}
        {textBoxes.map(box => (
          <div
            key={box.id}
            className={`text-box ${selectedTextId === box.id ? "selected" : ""} ${draggingTextBoxId === box.id ? "dragging" : ""}`}
            style={{
              left: `${box.displayX}px`,
              top: `${box.displayY}px`,
              fontSize: `${box.fontSize}px`,
              fontFamily: getCssFontFamily(box.fontFamily),
              fontWeight: box.fontWeight ?? 'normal',
              fontStyle: box.fontStyle ?? 'normal',
              color: box.color ?? '#000000'
            }}
            ref={(el) => {
              if (!el) {
                textBoxElementsRef.current.delete(box.id)
                return
              }
              textBoxElementsRef.current.set(box.id, el)
            }}
            onClick={(e) => {
              e.stopPropagation()
              setSelectedTextId(box.id)
            }}
            onPointerDown={(e) => {
              // Don't start drag when interacting with inner controls
              const targetEl = e.target instanceof Element ? e.target : e.target?.parentElement
              if (targetEl?.closest?.('.text-box-delete')) return
              if (targetEl?.closest?.('.text-box-content')) return

              e.stopPropagation()
              setSelectedTextId(box.id)
              startTextBoxDrag(e, box)
            }}
            onPointerMove={moveTextBoxDrag}
            onPointerUp={endTextBoxDrag}
            onPointerCancel={endTextBoxDrag}
          >
            <div
              className="text-box-content"
              data-textbox-content-id={box.id}
              contentEditable
              suppressContentEditableWarning
              ref={(el) => {
                // Avoid React re-render resetting caret while typing.
                // Only sync DOM from state when the element isn't focused.
                if (!el) return
                if (document.activeElement === el) return
                if (el.innerText !== (box.text ?? '')) {
                  el.innerText = box.text ?? ''
                }
              }}
              onInput={(e) => {
                onUpdateTextBox(box.id, { text: e.currentTarget.innerText })
              }}
              onPointerDown={(e) => {
                // Prevent drag when clicking inside text for editing
                setSelectedTextId(box.id)
                e.stopPropagation()
              }}
              onFocus={() => {
                setSelectedTextId(box.id)
              }}
              placeholder="Type here..."
            >
            </div>
            <button
              className="text-box-delete"
              onPointerDown={(e) => {
                // Prevent parent from capturing pointer / starting drag
                e.preventDefault()
                e.stopPropagation()
              }}
              onClick={(e) => {
                e.stopPropagation()
                onRemoveTextBox(box.id)
              }}
              title="Remove text box"
            >
              ×
            </button>
          </div>
        ))}
        {/* Draggable/Resizable image boxes */}
        {imageBoxes.map(imgBox => (
          <div
            key={imgBox.id}
            className="image-box"
            style={{
              left: `${imgBox.displayX}px`,
              top: `${imgBox.displayY}px`,
              width: `${imgBox.width}px`,
              height: `${imgBox.height}px`
            }}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'move'
            }}
            onDragEnd={(e) => {
              const canvas = canvasRef.current
              const rect = canvas.getBoundingClientRect()
              const newDisplayX = e.clientX - rect.left - imgBox.width / 2
              const newDisplayY = e.clientY - rect.top - imgBox.height / 2
              
              // Convert to PDF coordinates
              const scaleX = canvas.width / rect.width
              const scaleY = canvas.height / rect.height
              const canvasX = newDisplayX * scaleX
              const canvasY = newDisplayY * scaleY
              const newPdfX = canvasX / scale
              const newPdfY = canvasY / scale
              
              onUpdateImageBox(imgBox.id, { 
                displayX: newDisplayX, 
                displayY: newDisplayY,
                pdfX: newPdfX,
                pdfY: newPdfY
              })
            }}
          >
            <img 
              src={imgBox.imageData} 
              alt="Uploaded" 
              style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
            />
            <button
              className="image-box-delete"
              onClick={(e) => {
                e.stopPropagation()
                onRemoveImageBox(imgBox.id)
              }}
              title="Remove image"
            >
              ×
            </button>
            {/* Resize handles */}
            <div
              className="resize-handle resize-se"
              onMouseDown={(e) => {
                e.stopPropagation()
                e.preventDefault()
                setResizingImage({ id: imgBox.id, startX: e.clientX, startY: e.clientY, startWidth: imgBox.width, startHeight: imgBox.height })
              }}
              title="Drag to resize"
            />
          </div>
        ))}
        {dragRect && (
          <div
            className={`drag-selection ${editMode}-drag`}
            style={{
              left: `${dragRect.left}px`,
              top: `${dragRect.top}px`,
              width: `${dragRect.width}px`,
              height: `${dragRect.height}px`
            }}
          />
        )}
      </div>
      {editMode && (
        <div className="edit-hint">
          {getEditModeLabel()}
        </div>
      )}
    </div>
  )
}

export default PDFViewer
