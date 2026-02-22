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
  rectangleBoxes,
  circleBoxes,
  lineBoxes,
  selectedTextId,
  setSelectedTextId,
  selectedRectangleId,
  setSelectedRectangleId,
  selectedCircleId,
  setSelectedCircleId,
  selectedLineId,
  setSelectedLineId,
  autoFocusTextBoxId,
  onAutoFocusTextBoxDone,
  onAddTextBox,
  onUpdateTextBox,
  onRemoveTextBox,
  onUpdateImageBox,
  onRemoveImageBox,
  onUpdateRectangleBox,
  onRemoveRectangleBox,
  onUpdateCircleBox,
  onRemoveCircleBox,
  onUpdateLineBox,
  onRemoveLineBox,
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
  const imageBoxElementsRef = useRef(new Map())
  const imageDragRef = useRef(null)
  const imageResizeRef = useRef(null)
  const [draggingImageBoxId, setDraggingImageBoxId] = useState(null)
  const rectBoxElementsRef = useRef(new Map())
  const rectDragRef = useRef(null)
  const rectResizeRef = useRef(null)
  const [draggingRectBoxId, setDraggingRectBoxId] = useState(null)
  const circleBoxElementsRef = useRef(new Map())
  const circleDragRef = useRef(null)
  const circleResizeRef = useRef(null)
  const [draggingCircleBoxId, setDraggingCircleBoxId] = useState(null)
  const lineBoxElementsRef = useRef(new Map())
  const lineDragRef = useRef(null)
  const lineResizeRef = useRef(null)
  const linesSvgRef = useRef(null)
  const lineEndpointDragRef = useRef(null)
  const [draggingLineBoxId, setDraggingLineBoxId] = useState(null)
  const [scale] = useState(1.5)

  const getCanvasPdfScales = () => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    if (!rect.width || !rect.height) return null

    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    return {
      rect,
      scaleX,
      scaleY,
      pdfScaleX: scaleX / scale,
      pdfScaleY: scaleY / scale
    }
  }

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

  const applyImageDragFrame = () => {
    const drag = imageDragRef.current
    if (!drag) return

    const canvas = canvasRef.current
    const el = imageBoxElementsRef.current.get(drag.id)
    if (!canvas || !el) return

    const rect = canvas.getBoundingClientRect()
    let newDisplayX = drag.lastClientX - rect.left - drag.offsetX
    let newDisplayY = drag.lastClientY - rect.top - drag.offsetY

    newDisplayX = Math.max(0, Math.min(newDisplayX, rect.width - 10))
    newDisplayY = Math.max(0, Math.min(newDisplayY, rect.height - 10))

    el.style.left = `${newDisplayX}px`
    el.style.top = `${newDisplayY}px`

    drag.lastDisplayX = newDisplayX
    drag.lastDisplayY = newDisplayY
  }

  const startImageBoxDrag = (e, imgBox) => {
    if (!canvasRef.current) return
    if (e.button !== undefined && e.button !== 0) return
    if (!e.isPrimary) return

    e.preventDefault()

    const canvasRect = canvasRef.current.getBoundingClientRect()
    const offsetX = (e.clientX - canvasRect.left) - imgBox.displayX
    const offsetY = (e.clientY - canvasRect.top) - imgBox.displayY

    imageDragRef.current = {
      id: imgBox.id,
      pointerId: e.pointerId,
      offsetX,
      offsetY,
      lastClientX: e.clientX,
      lastClientY: e.clientY,
      lastDisplayX: imgBox.displayX,
      lastDisplayY: imgBox.displayY,
      width: imgBox.width,
      height: imgBox.height
    }

    setDraggingImageBoxId(imgBox.id)
    document.body.style.userSelect = 'none'
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const moveImageBoxDrag = (e) => {
    const drag = imageDragRef.current
    if (!drag) return
    if (!e.isPrimary || drag.pointerId !== e.pointerId) return

    drag.lastClientX = e.clientX
    drag.lastClientY = e.clientY
    applyImageDragFrame()
  }

  const endImageBoxDrag = (e) => {
    const drag = imageDragRef.current
    if (!drag) return
    if (!e.isPrimary || drag.pointerId !== e.pointerId) return

    applyImageDragFrame()

    document.body.style.userSelect = ''
    setDraggingImageBoxId(null)
    imageDragRef.current = null

    const scales = getCanvasPdfScales()
    if (!scales) return
    const newPdfX = drag.lastDisplayX * scales.pdfScaleX
    const newPdfY = drag.lastDisplayY * scales.pdfScaleY
    const newPdfWidth = (drag.width ?? 0) * scales.pdfScaleX
    const newPdfHeight = (drag.height ?? 0) * scales.pdfScaleY

    onUpdateImageBox(drag.id, {
      displayX: drag.lastDisplayX,
      displayY: drag.lastDisplayY,
      pdfX: newPdfX,
      pdfY: newPdfY,
      pdfWidth: Number.isFinite(newPdfWidth) && newPdfWidth > 0 ? newPdfWidth : undefined,
      pdfHeight: Number.isFinite(newPdfHeight) && newPdfHeight > 0 ? newPdfHeight : undefined
    })
  }

  const applyImageResizeFrame = () => {
    const rs = imageResizeRef.current
    if (!rs) return
    const el = imageBoxElementsRef.current.get(rs.id)
    if (!el) return

    const minSize = 50

    const deltaX = rs.lastClientX - rs.startX
    const deltaY = rs.lastClientY - rs.startY

    let nextWidth
    let nextHeight
    if (Math.abs(deltaX) >= Math.abs(deltaY)) {
      nextWidth = rs.startWidth + deltaX
      nextWidth = Math.max(minSize, nextWidth)
      nextHeight = nextWidth / rs.ratio
      if (nextHeight < minSize) {
        nextHeight = minSize
        nextWidth = nextHeight * rs.ratio
      }
    } else {
      nextHeight = rs.startHeight + deltaY
      nextHeight = Math.max(minSize, nextHeight)
      nextWidth = nextHeight * rs.ratio
      if (nextWidth < minSize) {
        nextWidth = minSize
        nextHeight = nextWidth / rs.ratio
      }
    }

    el.style.width = `${nextWidth}px`
    el.style.height = `${nextHeight}px`
    rs.lastWidth = nextWidth
    rs.lastHeight = nextHeight
  }

  const startImageResize = (e, imgBox) => {
    if (e.button !== undefined && e.button !== 0) return
    if (!e.isPrimary) return

    e.preventDefault()
    e.stopPropagation()

    const ratio = (imgBox.width && imgBox.height) ? (imgBox.width / imgBox.height) : 1

    imageResizeRef.current = {
      id: imgBox.id,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: imgBox.width,
      startHeight: imgBox.height,
      ratio: ratio || 1,
      lastClientX: e.clientX,
      lastClientY: e.clientY,
      lastWidth: imgBox.width,
      lastHeight: imgBox.height
    }

    document.body.style.userSelect = 'none'
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const moveImageResize = (e) => {
    const rs = imageResizeRef.current
    if (!rs) return
    if (!e.isPrimary || rs.pointerId !== e.pointerId) return

    rs.lastClientX = e.clientX
    rs.lastClientY = e.clientY
    applyImageResizeFrame()
  }

  const endImageResize = (e) => {
    const rs = imageResizeRef.current
    if (!rs) return
    if (!e.isPrimary || rs.pointerId !== e.pointerId) return

    applyImageResizeFrame()
    document.body.style.userSelect = ''
    imageResizeRef.current = null

    const scales = getCanvasPdfScales()
    const current = imageBoxes.find(b => b.id === rs.id)

    let nextPdfX
    let nextPdfY
    let nextPdfWidth
    let nextPdfHeight
    if (scales && current) {
      nextPdfX = current.displayX * scales.pdfScaleX
      nextPdfY = current.displayY * scales.pdfScaleY
      nextPdfWidth = rs.lastWidth * scales.pdfScaleX
      nextPdfHeight = rs.lastHeight * scales.pdfScaleY
    }

    onUpdateImageBox(rs.id, {
      width: rs.lastWidth,
      height: rs.lastHeight,
      ...(Number.isFinite(nextPdfX) ? { pdfX: nextPdfX } : {}),
      ...(Number.isFinite(nextPdfY) ? { pdfY: nextPdfY } : {}),
      ...(Number.isFinite(nextPdfWidth) ? { pdfWidth: nextPdfWidth } : {}),
      ...(Number.isFinite(nextPdfHeight) ? { pdfHeight: nextPdfHeight } : {})
    })
  }

  const applyRectDragFrame = () => {
    const drag = rectDragRef.current
    if (!drag) return

    const canvas = canvasRef.current
    const el = rectBoxElementsRef.current.get(drag.id)
    if (!canvas || !el) return

    const rect = canvas.getBoundingClientRect()
    let newDisplayX = drag.lastClientX - rect.left - drag.offsetX
    let newDisplayY = drag.lastClientY - rect.top - drag.offsetY

    newDisplayX = Math.max(0, Math.min(newDisplayX, rect.width - 10))
    newDisplayY = Math.max(0, Math.min(newDisplayY, rect.height - 10))

    el.style.left = `${newDisplayX}px`
    el.style.top = `${newDisplayY}px`

    drag.lastDisplayX = newDisplayX
    drag.lastDisplayY = newDisplayY
  }

  const startRectBoxDrag = (e, box) => {
    if (!canvasRef.current) return
    if (e.button !== undefined && e.button !== 0) return
    if (!e.isPrimary) return

    e.preventDefault()

    const canvasRect = canvasRef.current.getBoundingClientRect()
    const offsetX = (e.clientX - canvasRect.left) - box.displayX
    const offsetY = (e.clientY - canvasRect.top) - box.displayY

    rectDragRef.current = {
      id: box.id,
      pointerId: e.pointerId,
      offsetX,
      offsetY,
      lastClientX: e.clientX,
      lastClientY: e.clientY,
      lastDisplayX: box.displayX,
      lastDisplayY: box.displayY,
      width: box.width,
      height: box.height
    }

    setDraggingRectBoxId(box.id)
    document.body.style.userSelect = 'none'
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const moveRectBoxDrag = (e) => {
    const drag = rectDragRef.current
    if (!drag) return
    if (!e.isPrimary || drag.pointerId !== e.pointerId) return

    drag.lastClientX = e.clientX
    drag.lastClientY = e.clientY
    applyRectDragFrame()
  }

  const endRectBoxDrag = (e) => {
    const drag = rectDragRef.current
    if (!drag) return
    if (!e.isPrimary || drag.pointerId !== e.pointerId) return

    applyRectDragFrame()
    document.body.style.userSelect = ''
    setDraggingRectBoxId(null)
    rectDragRef.current = null

    const scales = getCanvasPdfScales()
    if (!scales) return

    const pdfX = drag.lastDisplayX * scales.pdfScaleX
    const pdfY = drag.lastDisplayY * scales.pdfScaleY
    const pdfWidth = (drag.width ?? 0) * scales.pdfScaleX
    const pdfHeight = (drag.height ?? 0) * scales.pdfScaleY
    const pdfScaleFactor = (scales.pdfScaleX + scales.pdfScaleY) / 2

    onUpdateRectangleBox(drag.id, {
      displayX: drag.lastDisplayX,
      displayY: drag.lastDisplayY,
      pdfX,
      pdfY,
      ...(Number.isFinite(pdfWidth) && pdfWidth > 0 ? { pdfWidth } : {}),
      ...(Number.isFinite(pdfHeight) && pdfHeight > 0 ? { pdfHeight } : {}),
      ...(Number.isFinite(pdfScaleFactor) ? { pdfScaleFactor } : {})
    })
  }

  const applyRectResizeFrame = () => {
    const rs = rectResizeRef.current
    if (!rs) return
    const el = rectBoxElementsRef.current.get(rs.id)
    if (!el) return

    const minSize = 10
    const deltaX = rs.lastClientX - rs.startX
    const deltaY = rs.lastClientY - rs.startY

    const nextWidth = Math.max(minSize, rs.startWidth + deltaX)
    const nextHeight = Math.max(minSize, rs.startHeight + deltaY)

    el.style.width = `${nextWidth}px`
    el.style.height = `${nextHeight}px`
    rs.lastWidth = nextWidth
    rs.lastHeight = nextHeight
  }

  const startRectResize = (e, box) => {
    if (e.button !== undefined && e.button !== 0) return
    if (!e.isPrimary) return

    e.preventDefault()
    e.stopPropagation()

    rectResizeRef.current = {
      id: box.id,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: box.width,
      startHeight: box.height,
      lastClientX: e.clientX,
      lastClientY: e.clientY,
      lastWidth: box.width,
      lastHeight: box.height
    }

    document.body.style.userSelect = 'none'
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const moveRectResize = (e) => {
    const rs = rectResizeRef.current
    if (!rs) return
    if (!e.isPrimary || rs.pointerId !== e.pointerId) return

    rs.lastClientX = e.clientX
    rs.lastClientY = e.clientY
    applyRectResizeFrame()
  }

  const endRectResize = (e) => {
    const rs = rectResizeRef.current
    if (!rs) return
    if (!e.isPrimary || rs.pointerId !== e.pointerId) return

    applyRectResizeFrame()
    document.body.style.userSelect = ''
    rectResizeRef.current = null

    const scales = getCanvasPdfScales()
    const current = rectangleBoxes?.find?.(b => b.id === rs.id)
    const pdfScaleFactor = scales ? (scales.pdfScaleX + scales.pdfScaleY) / 2 : undefined

    let nextPdfX
    let nextPdfY
    let nextPdfWidth
    let nextPdfHeight
    if (scales && current) {
      nextPdfX = current.displayX * scales.pdfScaleX
      nextPdfY = current.displayY * scales.pdfScaleY
      nextPdfWidth = rs.lastWidth * scales.pdfScaleX
      nextPdfHeight = rs.lastHeight * scales.pdfScaleY
    }

    onUpdateRectangleBox(rs.id, {
      width: rs.lastWidth,
      height: rs.lastHeight,
      ...(Number.isFinite(nextPdfX) ? { pdfX: nextPdfX } : {}),
      ...(Number.isFinite(nextPdfY) ? { pdfY: nextPdfY } : {}),
      ...(Number.isFinite(nextPdfWidth) ? { pdfWidth: nextPdfWidth } : {}),
      ...(Number.isFinite(nextPdfHeight) ? { pdfHeight: nextPdfHeight } : {}),
      ...(Number.isFinite(pdfScaleFactor) ? { pdfScaleFactor } : {})
    })
  }

  const applyCircleDragFrame = () => {
    const drag = circleDragRef.current
    if (!drag) return

    const canvas = canvasRef.current
    const el = circleBoxElementsRef.current.get(drag.id)
    if (!canvas || !el) return

    const rect = canvas.getBoundingClientRect()
    let newDisplayX = drag.lastClientX - rect.left - drag.offsetX
    let newDisplayY = drag.lastClientY - rect.top - drag.offsetY

    newDisplayX = Math.max(0, Math.min(newDisplayX, rect.width - 10))
    newDisplayY = Math.max(0, Math.min(newDisplayY, rect.height - 10))

    el.style.left = `${newDisplayX}px`
    el.style.top = `${newDisplayY}px`

    drag.lastDisplayX = newDisplayX
    drag.lastDisplayY = newDisplayY
  }

  const startCircleBoxDrag = (e, box) => {
    if (!canvasRef.current) return
    if (e.button !== undefined && e.button !== 0) return
    if (!e.isPrimary) return

    e.preventDefault()

    const canvasRect = canvasRef.current.getBoundingClientRect()
    const offsetX = (e.clientX - canvasRect.left) - box.displayX
    const offsetY = (e.clientY - canvasRect.top) - box.displayY

    circleDragRef.current = {
      id: box.id,
      pointerId: e.pointerId,
      offsetX,
      offsetY,
      lastClientX: e.clientX,
      lastClientY: e.clientY,
      lastDisplayX: box.displayX,
      lastDisplayY: box.displayY,
      width: box.width,
      height: box.height
    }

    setDraggingCircleBoxId(box.id)
    document.body.style.userSelect = 'none'
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const moveCircleBoxDrag = (e) => {
    const drag = circleDragRef.current
    if (!drag) return
    if (!e.isPrimary || drag.pointerId !== e.pointerId) return

    drag.lastClientX = e.clientX
    drag.lastClientY = e.clientY
    applyCircleDragFrame()
  }

  const endCircleBoxDrag = (e) => {
    const drag = circleDragRef.current
    if (!drag) return
    if (!e.isPrimary || drag.pointerId !== e.pointerId) return

    applyCircleDragFrame()
    document.body.style.userSelect = ''
    setDraggingCircleBoxId(null)
    circleDragRef.current = null

    const scales = getCanvasPdfScales()
    if (!scales) return

    const pdfX = drag.lastDisplayX * scales.pdfScaleX
    const pdfY = drag.lastDisplayY * scales.pdfScaleY
    const pdfWidth = (drag.width ?? 0) * scales.pdfScaleX
    const pdfHeight = (drag.height ?? 0) * scales.pdfScaleY
    const pdfScaleFactor = (scales.pdfScaleX + scales.pdfScaleY) / 2

    onUpdateCircleBox(drag.id, {
      displayX: drag.lastDisplayX,
      displayY: drag.lastDisplayY,
      pdfX,
      pdfY,
      ...(Number.isFinite(pdfWidth) && pdfWidth > 0 ? { pdfWidth } : {}),
      ...(Number.isFinite(pdfHeight) && pdfHeight > 0 ? { pdfHeight } : {}),
      ...(Number.isFinite(pdfScaleFactor) ? { pdfScaleFactor } : {})
    })
  }

  const applyCircleResizeFrame = () => {
    const rs = circleResizeRef.current
    if (!rs) return
    const el = circleBoxElementsRef.current.get(rs.id)
    if (!el) return

    const minSize = 10
    const deltaX = rs.lastClientX - rs.startX
    const deltaY = rs.lastClientY - rs.startY
    const rawWidth = rs.startWidth + deltaX
    const rawHeight = rs.startHeight + deltaY
    const nextSide = Math.max(minSize, Math.min(rawWidth, rawHeight))

    el.style.width = `${nextSide}px`
    el.style.height = `${nextSide}px`
    rs.lastWidth = nextSide
    rs.lastHeight = nextSide
  }

  const startCircleResize = (e, box) => {
    if (e.button !== undefined && e.button !== 0) return
    if (!e.isPrimary) return

    e.preventDefault()
    e.stopPropagation()

    circleResizeRef.current = {
      id: box.id,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: box.width,
      startHeight: box.height,
      lastClientX: e.clientX,
      lastClientY: e.clientY,
      lastWidth: box.width,
      lastHeight: box.height
    }

    document.body.style.userSelect = 'none'
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const moveCircleResize = (e) => {
    const rs = circleResizeRef.current
    if (!rs) return
    if (!e.isPrimary || rs.pointerId !== e.pointerId) return

    rs.lastClientX = e.clientX
    rs.lastClientY = e.clientY
    applyCircleResizeFrame()
  }

  const endCircleResize = (e) => {
    const rs = circleResizeRef.current
    if (!rs) return
    if (!e.isPrimary || rs.pointerId !== e.pointerId) return

    applyCircleResizeFrame()
    document.body.style.userSelect = ''
    circleResizeRef.current = null

    const scales = getCanvasPdfScales()
    const current = (circleBoxes || []).find(b => b.id === rs.id)
    const pdfScaleFactor = scales ? (scales.pdfScaleX + scales.pdfScaleY) / 2 : undefined

    let nextPdfX
    let nextPdfY
    let nextPdfWidth
    let nextPdfHeight
    if (scales && current) {
      nextPdfX = current.displayX * scales.pdfScaleX
      nextPdfY = current.displayY * scales.pdfScaleY
      const pdfW = rs.lastWidth * scales.pdfScaleX
      const pdfH = rs.lastHeight * scales.pdfScaleY
      const pdfSide = Math.min(pdfW, pdfH)
      nextPdfWidth = pdfSide
      nextPdfHeight = pdfSide
    }

    onUpdateCircleBox(rs.id, {
      width: rs.lastWidth,
      height: rs.lastHeight,
      ...(Number.isFinite(nextPdfX) ? { pdfX: nextPdfX } : {}),
      ...(Number.isFinite(nextPdfY) ? { pdfY: nextPdfY } : {}),
      ...(Number.isFinite(nextPdfWidth) ? { pdfWidth: nextPdfWidth } : {}),
      ...(Number.isFinite(nextPdfHeight) ? { pdfHeight: nextPdfHeight } : {}),
      ...(Number.isFinite(pdfScaleFactor) ? { pdfScaleFactor } : {})
    })
  }

  const applyLineDragFrame = () => {
    const drag = lineDragRef.current
    if (!drag) return

    const canvas = canvasRef.current
    const el = lineBoxElementsRef.current.get(drag.id)
    if (!canvas || !el) return

    const rect = canvas.getBoundingClientRect()
    let newDisplayX = drag.lastClientX - rect.left - drag.offsetX
    let newDisplayY = drag.lastClientY - rect.top - drag.offsetY

    newDisplayX = Math.max(0, Math.min(newDisplayX, rect.width - 10))
    newDisplayY = Math.max(0, Math.min(newDisplayY, rect.height - 10))

    el.style.left = `${newDisplayX}px`
    el.style.top = `${newDisplayY}px`

    drag.lastDisplayX = newDisplayX
    drag.lastDisplayY = newDisplayY
  }

  const startLineBoxDrag = (e, box) => {
    if (!canvasRef.current) return
    if (e.button !== undefined && e.button !== 0) return
    if (!e.isPrimary) return

    e.preventDefault()

    const canvasRect = canvasRef.current.getBoundingClientRect()
    const offsetX = (e.clientX - canvasRect.left) - box.displayX
    const offsetY = (e.clientY - canvasRect.top) - box.displayY

    lineDragRef.current = {
      id: box.id,
      pointerId: e.pointerId,
      offsetX,
      offsetY,
      lastClientX: e.clientX,
      lastClientY: e.clientY,
      lastDisplayX: box.displayX,
      lastDisplayY: box.displayY,
      width: box.width,
      height: box.height
    }

    setDraggingLineBoxId(box.id)
    document.body.style.userSelect = 'none'
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const moveLineBoxDrag = (e) => {
    const drag = lineDragRef.current
    if (!drag) return
    if (!e.isPrimary || drag.pointerId !== e.pointerId) return

    drag.lastClientX = e.clientX
    drag.lastClientY = e.clientY
    applyLineDragFrame()
  }

  const endLineBoxDrag = (e) => {
    const drag = lineDragRef.current
    if (!drag) return
    if (!e.isPrimary || drag.pointerId !== e.pointerId) return

    applyLineDragFrame()
    document.body.style.userSelect = ''
    setDraggingLineBoxId(null)
    lineDragRef.current = null

    const scales = getCanvasPdfScales()
    if (!scales) return

    const pdfX = drag.lastDisplayX * scales.pdfScaleX
    const pdfY = drag.lastDisplayY * scales.pdfScaleY
    const pdfWidth = (drag.width ?? 0) * scales.pdfScaleX
    const pdfHeight = (drag.height ?? 0) * scales.pdfScaleY
    const pdfScaleFactor = (scales.pdfScaleX + scales.pdfScaleY) / 2

    onUpdateLineBox(drag.id, {
      displayX: drag.lastDisplayX,
      displayY: drag.lastDisplayY,
      pdfX,
      pdfY,
      ...(Number.isFinite(pdfWidth) && pdfWidth > 0 ? { pdfWidth } : {}),
      ...(Number.isFinite(pdfHeight) && pdfHeight > 0 ? { pdfHeight } : {}),
      ...(Number.isFinite(pdfScaleFactor) ? { pdfScaleFactor } : {})
    })
  }

  const applyLineResizeFrame = () => {
    const rs = lineResizeRef.current
    if (!rs) return
    const el = lineBoxElementsRef.current.get(rs.id)
    if (!el) return

    const minSize = 10
    const deltaX = rs.lastClientX - rs.startX
    const deltaY = rs.lastClientY - rs.startY
    const nextWidth = Math.max(minSize, rs.startWidth + deltaX)
    const nextHeight = Math.max(minSize, rs.startHeight + deltaY)

    el.style.width = `${nextWidth}px`
    el.style.height = `${nextHeight}px`
    rs.lastWidth = nextWidth
    rs.lastHeight = nextHeight
  }

  const startLineResize = (e, box) => {
    if (e.button !== undefined && e.button !== 0) return
    if (!e.isPrimary) return

    e.preventDefault()
    e.stopPropagation()

    lineResizeRef.current = {
      id: box.id,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: box.width,
      startHeight: box.height,
      lastClientX: e.clientX,
      lastClientY: e.clientY,
      lastWidth: box.width,
      lastHeight: box.height
    }

    document.body.style.userSelect = 'none'
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const moveLineResize = (e) => {
    const rs = lineResizeRef.current
    if (!rs) return
    if (!e.isPrimary || rs.pointerId !== e.pointerId) return

    rs.lastClientX = e.clientX
    rs.lastClientY = e.clientY
    applyLineResizeFrame()
  }

  const endLineResize = (e) => {
    const rs = lineResizeRef.current
    if (!rs) return
    if (!e.isPrimary || rs.pointerId !== e.pointerId) return

    applyLineResizeFrame()
    document.body.style.userSelect = ''
    lineResizeRef.current = null

    const scales = getCanvasPdfScales()
    const current = (lineBoxes || []).find(b => b.id === rs.id)
    const pdfScaleFactor = scales ? (scales.pdfScaleX + scales.pdfScaleY) / 2 : undefined

    let nextPdfX
    let nextPdfY
    let nextPdfWidth
    let nextPdfHeight
    if (scales && current) {
      nextPdfX = current.displayX * scales.pdfScaleX
      nextPdfY = current.displayY * scales.pdfScaleY
      nextPdfWidth = rs.lastWidth * scales.pdfScaleX
      nextPdfHeight = rs.lastHeight * scales.pdfScaleY
    }

    onUpdateLineBox(rs.id, {
      width: rs.lastWidth,
      height: rs.lastHeight,
      ...(Number.isFinite(nextPdfX) ? { pdfX: nextPdfX } : {}),
      ...(Number.isFinite(nextPdfY) ? { pdfY: nextPdfY } : {}),
      ...(Number.isFinite(nextPdfWidth) ? { pdfWidth: nextPdfWidth } : {}),
      ...(Number.isFinite(nextPdfHeight) ? { pdfHeight: nextPdfHeight } : {}),
      ...(Number.isFinite(pdfScaleFactor) ? { pdfScaleFactor } : {})
    })
  }

  // Ensure newly uploaded images (default position/size) have correct PDF-unit geometry
  useEffect(() => {
    if (!pdfDocument) return
    if (!imageBoxes || imageBoxes.length === 0) return

    const scales = getCanvasPdfScales()
    if (!scales) return

    const toSync = imageBoxes.filter(b => b.page === currentPage)
    for (const b of toSync) {
      if (
        typeof b.pdfWidth === 'number' && Number.isFinite(b.pdfWidth) &&
        typeof b.pdfHeight === 'number' && Number.isFinite(b.pdfHeight) &&
        typeof b.pdfX === 'number' && Number.isFinite(b.pdfX) &&
        typeof b.pdfY === 'number' && Number.isFinite(b.pdfY)
      ) {
        continue
      }

      const pdfX = b.displayX * scales.pdfScaleX
      const pdfY = b.displayY * scales.pdfScaleY
      const pdfWidth = b.width * scales.pdfScaleX
      const pdfHeight = b.height * scales.pdfScaleY

      onUpdateImageBox(b.id, {
        pdfX,
        pdfY,
        pdfWidth,
        pdfHeight
      })
    }
  }, [pdfDocument, currentPage, imageBoxes])

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

  // Image resize is handled via pointer capture on the resize handle.

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

    const dx = dragEnd.x - dragStart.x
    const dy = dragEnd.y - dragStart.y

    const displayX1 = Math.min(dragStart.x, dragEnd.x)
    const displayY1 = Math.min(dragStart.y, dragEnd.y)
    const displayW = Math.abs(dx)
    const displayH = Math.abs(dy)

    const pdfScaleX = scaleX / scale
    const pdfScaleY = scaleY / scale
    const pdfScaleFactor = (pdfScaleX + pdfScaleY) / 2

    if (editMode === 'line') {
      const displayLen = Math.hypot(dx, dy)
      if (displayLen > 10) {
        onAddLine({
          x1: dragStart.x,
          y1: dragStart.y,
          x2: dragEnd.x,
          y2: dragEnd.y,
          pdfX1: dragStart.x * pdfScaleX,
          pdfY1: dragStart.y * pdfScaleY,
          pdfX2: dragEnd.x * pdfScaleX,
          pdfY2: dragEnd.y * pdfScaleY,
          pdfScaleFactor
        })
      }
    } else {
      // Require minimum drag size for box-shaped tools
      if (width > 10 && height > 10) {
        if (editMode === 'rectangle') {
        onAddRectangle({
          displayX: displayX1,
          displayY: displayY1,
          width: displayW,
          height: displayH,
          pdfX: pdfX1,
          pdfY: pdfY1,
          pdfWidth: width,
          pdfHeight: height,
          pdfScaleFactor
        })
        } else if (editMode === 'circle') {
        // Force perfect circle: keep 1:1 using the smaller side.
        const displaySide = Math.min(displayW, displayH)
        const pdfSide = Math.min(displaySide * pdfScaleX, displaySide * pdfScaleY)

        const circleDisplayX = dx >= 0 ? dragStart.x : (dragStart.x - displaySide)
        const circleDisplayY = dy >= 0 ? dragStart.y : (dragStart.y - displaySide)

        const circlePdfX = circleDisplayX * pdfScaleX
        const circlePdfY = circleDisplayY * pdfScaleY

        onAddCircle({
          displayX: circleDisplayX,
          displayY: circleDisplayY,
          width: displaySide,
          height: displaySide,
          pdfX: circlePdfX,
          pdfY: circlePdfY,
          pdfWidth: pdfSide,
          pdfHeight: pdfSide,
          pdfScaleFactor
        })
        } else if (editMode === 'highlight') {
        onAddHighlight(pdfX1, pdfY1, width, height)
        }
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

    if (editMode === 'circle') {
      const dx = dragEnd.x - dragStart.x
      const dy = dragEnd.y - dragStart.y
      const side = Math.min(Math.abs(dx), Math.abs(dy))
      return {
        left: dx >= 0 ? dragStart.x : (dragStart.x - side),
        top: dy >= 0 ? dragStart.y : (dragStart.y - side),
        width: side,
        height: side
      }
    }

    return {
      left: Math.min(dragStart.x, dragEnd.x),
      top: Math.min(dragStart.y, dragEnd.y),
      width: Math.abs(dragEnd.x - dragStart.x),
      height: Math.abs(dragEnd.y - dragStart.y)
    }
  }

  const dragRect = getDragRect()

  const getLineDisplayEndpoints = (box) => {
    if (!box) return null

    if (
      typeof box.x1 === 'number' && typeof box.y1 === 'number' &&
      typeof box.x2 === 'number' && typeof box.y2 === 'number'
    ) {
      return { x1: box.x1, y1: box.y1, x2: box.x2, y2: box.y2 }
    }

    // Back-compat: older boxes stored as bounding rect + direction flags
    if (
      typeof box.displayX === 'number' && typeof box.displayY === 'number' &&
      typeof box.width === 'number' && typeof box.height === 'number'
    ) {
      const left = box.displayX
      const top = box.displayY
      const right = box.displayX + box.width
      const bottom = box.displayY + box.height

      const startOnRight = !!box.startOnRight
      const startOnBottom = !!box.startOnBottom

      const x1 = startOnRight ? right : left
      const y1 = startOnBottom ? bottom : top
      const x2 = startOnRight ? left : right
      const y2 = startOnBottom ? top : bottom
      return { x1, y1, x2, y2 }
    }

    return null
  }

  const startLineDrag = (e, box) => {
    if (!box || !e.isPrimary) return
    if (e.button !== undefined && e.button !== 0) return

    const endpoints = getLineDisplayEndpoints(box)
    if (!endpoints) return

    e.preventDefault()
    e.stopPropagation()

    if (setSelectedTextId) setSelectedTextId(null)
    if (setSelectedRectangleId) setSelectedRectangleId(null)
    if (setSelectedCircleId) setSelectedCircleId(null)
    if (setSelectedLineId) setSelectedLineId(box.id)

    setDraggingLineBoxId(box.id)

    lineEndpointDragRef.current = {
      id: box.id,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX1: endpoints.x1,
      startY1: endpoints.y1,
      startX2: endpoints.x2,
      startY2: endpoints.y2,
      lastDx: 0,
      lastDy: 0
    }

    document.body.style.userSelect = 'none'
    if (linesSvgRef.current) {
      linesSvgRef.current.setPointerCapture(e.pointerId)
    }
  }

  const moveLineDrag = (e) => {
    const drag = lineEndpointDragRef.current
    if (!drag) return
    if (!e.isPrimary || drag.pointerId !== e.pointerId) return

    const dx = e.clientX - drag.startClientX
    const dy = e.clientY - drag.startClientY
    drag.lastDx = dx
    drag.lastDy = dy

    if (onUpdateLineBox) {
      onUpdateLineBox(drag.id, {
        x1: drag.startX1 + dx,
        y1: drag.startY1 + dy,
        x2: drag.startX2 + dx,
        y2: drag.startY2 + dy
      })
    }
  }

  const endLineDrag = (e) => {
    const drag = lineEndpointDragRef.current
    if (!drag) return
    if (!e.isPrimary || drag.pointerId !== e.pointerId) return

    document.body.style.userSelect = ''
    lineEndpointDragRef.current = null
    setDraggingLineBoxId(null)

    const scales = getCanvasPdfScales()
    if (!scales || !onUpdateLineBox) return

    const finalX1 = drag.startX1 + drag.lastDx
    const finalY1 = drag.startY1 + drag.lastDy
    const finalX2 = drag.startX2 + drag.lastDx
    const finalY2 = drag.startY2 + drag.lastDy

    const pdfScaleFactor = (scales.pdfScaleX + scales.pdfScaleY) / 2

    onUpdateLineBox(drag.id, {
      x1: finalX1,
      y1: finalY1,
      x2: finalX2,
      y2: finalY2,
      pdfX1: finalX1 * scales.pdfScaleX,
      pdfY1: finalY1 * scales.pdfScaleY,
      pdfX2: finalX2 * scales.pdfScaleX,
      pdfY2: finalY2 * scales.pdfScaleY,
      ...(Number.isFinite(pdfScaleFactor) ? { pdfScaleFactor } : {})
    })
  }

  return (
    <div className="pdf-viewer">
      <div
        className="canvas-container"
        ref={containerRef}
        onMouseDownCapture={(e) => {
          // Deselect text box when clicking anywhere outside a text box
          // (capture phase ensures this runs even if child stops propagation)
          const targetEl = e.target instanceof Element ? e.target : e.target?.parentElement
          if (targetEl && targetEl.closest && (
            targetEl.closest('.text-box') ||
            targetEl.closest('.rect-box') ||
            targetEl.closest('.circle-box') ||
            targetEl.closest('.lines-overlay')
          )) {
            return
          }
          setSelectedTextId(null)
          if (setSelectedRectangleId) setSelectedRectangleId(null)
          if (setSelectedCircleId) setSelectedCircleId(null)
          if (setSelectedLineId) setSelectedLineId(null)
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
            className={`image-box ${draggingImageBoxId === imgBox.id ? 'dragging' : ''}`}
            style={{
              left: `${imgBox.displayX}px`,
              top: `${imgBox.displayY}px`,
              width: `${imgBox.width}px`,
              height: `${imgBox.height}px`
            }}
            ref={(el) => {
              if (!el) {
                imageBoxElementsRef.current.delete(imgBox.id)
                return
              }
              imageBoxElementsRef.current.set(imgBox.id, el)
            }}
            onPointerDown={(e) => {
              const targetEl = e.target instanceof Element ? e.target : e.target?.parentElement
              if (targetEl?.closest?.('.image-box-delete')) return
              if (targetEl?.closest?.('.resize-handle')) return

              e.stopPropagation()
              startImageBoxDrag(e, imgBox)
            }}
            onPointerMove={moveImageBoxDrag}
            onPointerUp={endImageBoxDrag}
            onPointerCancel={endImageBoxDrag}
          >
            <img 
              src={imgBox.imageData} 
              alt="Uploaded" 
              style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
            />
            <button
              className="image-box-delete"
              onPointerDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
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
              onPointerDown={(e) => startImageResize(e, imgBox)}
              onPointerMove={moveImageResize}
              onPointerUp={endImageResize}
              onPointerCancel={endImageResize}
              title="Drag to resize"
            />
          </div>
        ))}

        {/* Editable rectangle boxes */}
        {(rectangleBoxes || []).map(box => (
          <div
            key={box.id}
            className={`rect-box ${selectedRectangleId === box.id ? 'selected' : ''} ${draggingRectBoxId === box.id ? 'dragging' : ''}`}
            style={{
              left: `${box.displayX}px`,
              top: `${box.displayY}px`,
              width: `${box.width}px`,
              height: `${box.height}px`,
              border: `${box.strokeWidth ?? 2}px solid ${box.strokeColor ?? '#000000'}`,
              background: box.filled ? (box.fillColor ?? '#000000') : 'transparent'
            }}
            ref={(el) => {
              if (!el) {
                rectBoxElementsRef.current.delete(box.id)
                return
              }
              rectBoxElementsRef.current.set(box.id, el)
            }}
            onClick={(e) => {
              e.stopPropagation()
              if (setSelectedTextId) setSelectedTextId(null)
              if (setSelectedRectangleId) setSelectedRectangleId(box.id)
            }}
            onPointerDown={(e) => {
              const targetEl = e.target instanceof Element ? e.target : e.target?.parentElement
              if (targetEl?.closest?.('.rect-box-delete')) return
              if (targetEl?.closest?.('.resize-handle')) return

              e.stopPropagation()
              if (setSelectedTextId) setSelectedTextId(null)
              if (setSelectedRectangleId) setSelectedRectangleId(box.id)
              startRectBoxDrag(e, box)
            }}
            onPointerMove={moveRectBoxDrag}
            onPointerUp={endRectBoxDrag}
            onPointerCancel={endRectBoxDrag}
            title="Rectangle"
          >
            <button
              className="rect-box-delete"
              onPointerDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
              onClick={(e) => {
                e.stopPropagation()
                if (onRemoveRectangleBox) onRemoveRectangleBox(box.id)
              }}
              title="Remove rectangle"
            >
              ×
            </button>
            <div
              className="resize-handle resize-se"
              onPointerDown={(e) => startRectResize(e, box)}
              onPointerMove={moveRectResize}
              onPointerUp={endRectResize}
              onPointerCancel={endRectResize}
              title="Drag to resize"
            />
          </div>
        ))}

        {/* Editable circle/ellipse boxes */}
        {(circleBoxes || []).map(box => (
          <div
            key={box.id}
            className={`circle-box ${selectedCircleId === box.id ? 'selected' : ''} ${draggingCircleBoxId === box.id ? 'dragging' : ''}`}
            style={{
              left: `${box.displayX}px`,
              top: `${box.displayY}px`,
              width: `${box.width}px`,
              height: `${box.height}px`,
              border: `${box.strokeWidth ?? 2}px solid ${box.strokeColor ?? '#000000'}`,
              background: box.filled ? (box.fillColor ?? '#000000') : 'transparent'
            }}
            ref={(el) => {
              if (!el) {
                circleBoxElementsRef.current.delete(box.id)
                return
              }
              circleBoxElementsRef.current.set(box.id, el)
            }}
            onClick={(e) => {
              e.stopPropagation()
              if (setSelectedTextId) setSelectedTextId(null)
              if (setSelectedRectangleId) setSelectedRectangleId(null)
              if (setSelectedLineId) setSelectedLineId(null)
              if (setSelectedCircleId) setSelectedCircleId(box.id)
            }}
            onPointerDown={(e) => {
              const targetEl = e.target instanceof Element ? e.target : e.target?.parentElement
              if (targetEl?.closest?.('.circle-box-delete')) return
              if (targetEl?.closest?.('.resize-handle')) return

              e.stopPropagation()
              if (setSelectedTextId) setSelectedTextId(null)
              if (setSelectedRectangleId) setSelectedRectangleId(null)
              if (setSelectedLineId) setSelectedLineId(null)
              if (setSelectedCircleId) setSelectedCircleId(box.id)
              startCircleBoxDrag(e, box)
            }}
            onPointerMove={moveCircleBoxDrag}
            onPointerUp={endCircleBoxDrag}
            onPointerCancel={endCircleBoxDrag}
            title="Circle"
          >
            <button
              className="circle-box-delete"
              onPointerDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
              onClick={(e) => {
                e.stopPropagation()
                if (onRemoveCircleBox) onRemoveCircleBox(box.id)
              }}
              title="Remove circle"
            >
              ×
            </button>
            <div
              className="resize-handle resize-se"
              onPointerDown={(e) => startCircleResize(e, box)}
              onPointerMove={moveCircleResize}
              onPointerUp={endCircleResize}
              onPointerCancel={endCircleResize}
              title="Drag to resize"
            />
          </div>
        ))}

        {/* Editable line boxes */}
        {/* Editable lines (endpoint-based, not box-based) */}
        <svg
          ref={linesSvgRef}
          className="lines-overlay"
          width="100%"
          height="100%"
          style={{ pointerEvents: 'none' }}
          onPointerMove={moveLineDrag}
          onPointerUp={endLineDrag}
          onPointerCancel={endLineDrag}
        >
          {(lineBoxes || []).map((box) => {
            const endpoints = getLineDisplayEndpoints(box)
            if (!endpoints) return null

            const strokeWidth = box.strokeWidth ?? 2
            const strokeColor = box.strokeColor ?? '#000000'

            const hitWidth = Math.max(12, strokeWidth + 10)
            const isSelected = selectedLineId === box.id

            return (
              <g key={box.id}>
                {/* Invisible wide stroke for easy clicking/dragging */}
                <line
                  className={`line-hit ${isSelected ? 'selected' : ''} ${draggingLineBoxId === box.id ? 'dragging' : ''}`}
                  x1={endpoints.x1}
                  y1={endpoints.y1}
                  x2={endpoints.x2}
                  y2={endpoints.y2}
                  stroke="transparent"
                  strokeWidth={hitWidth}
                  strokeLinecap="round"
                  pointerEvents="stroke"
                  onPointerDown={(e) => startLineDrag(e, box)}
                />

                {/* Visible line */}
                <line
                  x1={endpoints.x1}
                  y1={endpoints.y1}
                  x2={endpoints.x2}
                  y2={endpoints.y2}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  pointerEvents="none"
                  opacity={isSelected ? 0.9 : 1}
                />

              </g>
            )
          })}
        </svg>
        {editMode === 'line' && isDragging && dragStart && dragEnd ? (
          <svg className="line-drag-preview" width="100%" height="100%">
            <line
              x1={dragStart.x}
              y1={dragStart.y}
              x2={dragEnd.x}
              y2={dragEnd.y}
              stroke="#8C8C9C"
              strokeWidth="2"
              strokeDasharray="6 4"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          dragRect && (
            <div
              className={`drag-selection ${editMode}-drag`}
              style={{
                left: `${dragRect.left}px`,
                top: `${dragRect.top}px`,
                width: `${dragRect.width}px`,
                height: `${dragRect.height}px`
              }}
            />
          )
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
